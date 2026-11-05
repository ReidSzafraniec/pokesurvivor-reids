(function () {
  'use strict';

  const VERSION = 1, INTERVAL = 100, HEARTBEAT = 1000, TIMEOUT = 5000;
  const LOCATIONS = new Set(['town', 'menu', 'ready', 'away']);
  const START_FAILED = 'No se pudo iniciar. Todos deben volver a prepararse.';

  function create(game, host, { walkable }) {
    const { Social: social, Net: net } = game;
    const now = () => host.performance.now();
    const token = () => host.crypto.randomUUID();
    const listeners = new Set();
    let room = null, identity = '', roster = '', uid = '', session = '', nonce = '';
    let revision = 0, sequence = 0, received = 0, lastHost = 0, lastSend = -Infinity;
    let members = new Map(), pose = null, menuOpen = false, ready = false;
    let timer = null, launch = null, dirty = true, disposed = false, lastView = '';
    let lastWarning = -Infinity;
    let wasLost = false;

    function warn(reason) {
      if (now() - lastWarning < HEARTBEAT) return;
      lastWarning = now();
      host.console.warn('[Town multiplayer]', reason);
    }

    function notice(message) {
      game.UI.toast(game.T(message), 3500);
    }

    function cleanPose(value) {
      if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
          !walkable(value.x, value.y) || !Number.isInteger(value.dir) || value.dir < 0 || value.dir > 7 ||
          typeof value.walking !== 'boolean' || !Number.isInteger(value.dex) || !game.DEX_BY[value.dex] ||
          typeof value.shiny !== 'boolean' || !LOCATIONS.has(value.location) ||
          (value.skin !== null && (typeof value.skin !== 'string' || value.skin.length > 80 ||
            !game.Skins.get(value.skin, value.dex)))) return null;
      return {
        x: value.x, y: value.y, dir: value.dir, walking: value.location === 'town' && value.walking,
        dex: value.dex, shiny: value.shiny, skin: value.skin, location: value.location
      };
    }

    function localMember() {
      const me = members.get(uid);
      if (me) Object.assign(me, { pose, ready, connected: true, lastSeen: now() });
    }

    function getSnapshot() {
      const list = [...members.values()].map(m => ({
        uid: m.uid, name: m.name, connected: m.connected,
        ready: m.uid === uid ? ready : m.ready,
        pose: (m.uid === uid ? pose : m.pose) ? { ...(m.uid === uid ? pose : m.pose) } : null
      }));
      const connected = !!session && list.every(m => m.connected);
      return {
        members: list, ready, launching: !!launch,
        canStart: !!room?.isHost && !room.lost && !launch && menuOpen && list.length >= 2 &&
          connected && list.every(m => m.ready && m.pose?.location === 'ready'),
        connection: !room ? 'solo' : room.lost ? 'reconnecting' : connected ? 'connected' : 'connecting'
      };
    }

    function emit() {
      const snapshot = getSnapshot(), signature = JSON.stringify(snapshot);
      if (signature === lastView) return;
      lastView = signature;
      for (const listener of listeners) listener(snapshot);
    }

    function packet(k, data = {}) {
      return { k, v: VERSION, room: room.id, session, revision, seq: ++sequence, ...data };
    }

    function isConnected(mode) {
      return mode === 'direct' || mode === 'relay';
    }

    function send(to, k, data) {
      if (!room || room.lost || !isConnected(net.mode(to)) || net.busy(to)) return false;
      net.send(to, packet(k, data));
      return true;
    }

    function broadcast(k, data) {
      for (const m of members.values()) if (m.uid !== uid) send(m.uid, k, data);
    }

    function publish(force = false) {
      if (!room?.isHost || (!force && !dirty && now() - lastSend < HEARTBEAT)) return;
      localMember();
      const list = getSnapshot().members;
      let pending = false;
      for (const m of members.values()) {
        if (m.uid !== uid && m.nonce && m.connected) {
          if (!send(m.uid, 'town-snapshot', { nonce: m.nonce, members: list })) pending = true;
        }
      }
      dirty = pending;
      lastSend = now();
    }

    function cancelLaunch(report = false, notify = true) {
      const pending = launch;
      if (!pending) return;
      launch = null;
      if (notify && room) {
        if (room.isHost) broadcast('town-cancel', { id: pending.id });
        else send(room.host, 'town-cancel', { id: pending.id, nonce });
      }
      ready = false;
      for (const m of members.values()) m.ready = false;
      if (room?.isHost) revision++;
      dirty = true;
      pending.resolve?.(false);
      if (report) notice(START_FAILED);
      emit();
    }

    function resetReady(bump = false) {
      cancelLaunch(true);
      ready = false;
      for (const m of members.values()) m.ready = false;
      if (bump && room?.isHost) revision++;
      dirty = true;
      localMember();
    }

    function disconnectHost() {
      if (!session) return;
      resetReady();
      session = '';
      nonce = token();
      received = 0;
      lastSend = -Infinity;
      for (const m of members.values()) if (m.uid !== uid) m.connected = false;
    }

    function syncRoom() {
      if (disposed) return;
      const current = social.room;
      const valid = current && social.uid && game.DB.fb?.uid === social.uid &&
        Array.isArray(current.members) && current.members.length <= 4;
      const key = valid ? [social.uid, current.id, current.host].join(':') : '';
      if (key !== identity) {
        cancelLaunch(false);
        identity = key;
        room = valid ? current : null;
        uid = social.uid || '';
        session = room?.isHost ? token() : '';
        nonce = token();
        revision = 1;
        sequence = received = 0;
        lastSend = -Infinity;
        lastHost = now();
        members.clear();
        roster = '';
        ready = menuOpen = false;
        wasLost = false;
        dirty = true;
      }
      room = valid ? current : null;
      if (!room) {
        if (timer !== null) host.clearInterval(timer);
        timer = null;
        emit();
        return;
      }
      const ids = room.members.map(m => m.uid);
      if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) {
        warn('Invalid room roster');
        return;
      }
      const signature = [...ids].sort().join('|');
      if (signature !== roster) {
        roster = signature;
        const old = members;
        members = new Map(room.members.map(m => [m.uid, {
          uid: m.uid, name: String(m.name || '').slice(0, 24),
          pose: old.get(m.uid)?.pose || null, nonce: old.get(m.uid)?.nonce || '',
          seq: old.get(m.uid)?.seq || 0, connected: old.get(m.uid)?.connected || false,
          ready: false, lastSeen: old.get(m.uid)?.lastSeen || now()
        }]));
        resetReady(true);
        if (!room.isHost) { session = ''; nonce = token(); received = 0; lastSend = -Infinity; }
      }
      for (const m of room.members) members.get(m.uid).name = String(m.name || '').slice(0, 24);
      if (!!room.lost !== wasLost) {
        wasLost = !!room.lost;
        if (room.isHost) {
          resetReady(true);
          for (const m of members.values()) {
            if (m.uid === uid) continue;
            m.connected = false;
            if (!wasLost && m.nonce) send(m.uid, 'town-reset', { nonce: m.nonce });
          }
        } else disconnectHost();
      }
      localMember();
      if (timer === null) timer = host.setInterval(tick, INTERVAL);
      emit();
    }

    function peerChanged(peer, mode) {
      if (disposed || !room || isConnected(mode) || !members.has(peer)) return;
      if (room.isHost) {
        const m = members.get(peer);
        if (m.connected) {
          m.connected = false;
          resetReady(true);
          publish(true);
        }
      } else if (peer === room.host) disconnectHost();
      emit();
    }

    function tick() {
      syncRoom();
      if (!room) return;
      if (launch && now() >= launch.deadline) cancelLaunch(true);
      if (room.isHost) {
        for (const m of members.values()) {
          if (m.uid !== uid && m.connected &&
              (room.lost || !isConnected(net.mode(m.uid)) || now() - m.lastSeen > TIMEOUT)) {
            m.connected = false;
            resetReady(true);
          }
        }
        publish();
      } else {
        if (room.lost || !isConnected(net.mode(room.host)) || (session && now() - lastHost > TIMEOUT)) disconnectHost();
        if (!session) {
          if (now() - lastSend >= HEARTBEAT && send(room.host, 'town-hello', { nonce })) lastSend = now();
        } else if (pose && (dirty || now() - lastSend >= HEARTBEAT)) {
          if (send(room.host, 'town-pose', { nonce, pose, ready })) { dirty = false; lastSend = now(); }
        }
      }
      emit();
    }

    function validSnapshot(message) {
      if (!Array.isArray(message.members) || message.members.length !== members.size || message.members.length > 4) return null;
      const seen = new Set(), cleaned = [];
      for (const m of message.members) {
        if (!m || !members.has(m.uid) || seen.has(m.uid) || typeof m.ready !== 'boolean' ||
            typeof m.connected !== 'boolean') return null;
        const nextPose = m.pose === null ? null : cleanPose(m.pose);
        if (m.pose !== null && !nextPose) return null;
        seen.add(m.uid);
        cleaned.push({ uid: m.uid, ready: m.ready, connected: m.connected, pose: nextPose });
      }
      return cleaned;
    }

    function finishLaunch() {
      if (!launch || !room?.isHost || launch.acks.size !== members.size) return;
      const pending = launch;
      if (now() >= pending.deadline || !menuOpen || !ready || game.Game.state !== 'ui' || room.lost ||
          [...members.values()].some(m => !m.connected || !m.ready || (m.uid !== uid && !isConnected(net.mode(m.uid))))) {
        cancelLaunch(true);
        return;
      }
      pending.phase = 'starting';
      try {
        pending.startNative();
        if (launch === pending) {
          cancelLaunch(true);
          return;
        }
        pending.resolve(true);
      } catch (error) {
        cancelLaunch(true);
        host.console.warn('[Town multiplayer] Expedition start failed:', error);
        pending.resolve(false);
      }
    }

    function receive(from, message) {
      if (disposed || !message || typeof message.k !== 'string' || !message.k.startsWith('town-')) return;
      syncRoom();
      if (!room || room.lost || message.room !== room.id || from === uid || !members.has(from)) return;
      if (message.v !== VERSION || !Number.isSafeInteger(message.seq) || message.seq < 1 ||
          !Number.isSafeInteger(message.revision) || message.revision < 1 ||
          typeof message.session !== 'string' || message.session.length > 100) {
        warn('Invalid or incompatible town packet');
        return;
      }
      if (!isConnected(net.mode(from))) return;
      if (room.isHost) {
        const m = members.get(from);
        if (message.k === 'town-hello') {
          if (typeof message.nonce !== 'string' || !message.nonce || message.nonce.length > 100) return warn('Invalid town handshake');
          if (m.nonce !== message.nonce || !m.connected) {
            resetReady(true);
            Object.assign(m, { nonce: message.nonce, seq: 0, connected: true });
          }
          m.lastSeen = now();
          send(from, 'town-welcome', { nonce: m.nonce, members: getSnapshot().members });
          publish(true);
          emit();
          return;
        }
        if (message.session !== session || message.revision !== revision ||
            message.nonce !== m.nonce || !m.connected || message.seq <= m.seq) return;
        if (message.k === 'town-pose') {
          const next = cleanPose(message.pose);
          if (!next || typeof message.ready !== 'boolean') return warn('Invalid town pose');
          m.pose = next;
          if ((!message.ready || next.location !== 'ready') && m.ready) {
            m.ready = false;
            cancelLaunch(true);
          }
          dirty = true;
        } else if (message.k === 'town-ready') {
          if (typeof message.ready !== 'boolean') return warn('Invalid readiness');
          const next = cleanPose(message.pose);
          if (!next || (message.ready && next.location !== 'ready')) return warn('Invalid ready-menu pose');
          m.pose = next;
          m.ready = message.ready;
          if (!m.ready) cancelLaunch(true);
          dirty = true;
        } else if (message.k === 'town-ack') {
          if (!launch || message.id !== launch.id || typeof message.accepted !== 'boolean') return;
          if (!message.accepted) cancelLaunch(true);
          else launch.acks.add(from);
        } else if (message.k === 'town-cancel') {
          if (!launch || message.id !== launch.id) return;
          cancelLaunch(true);
        } else return;
        m.seq = message.seq;
        m.lastSeen = now();
        if (message.k !== 'town-pose') publish(true);
        emit();
        finishLaunch();
        return;
      }
      if (from !== room.host || message.nonce && message.nonce !== nonce) return;
      if (message.k === 'town-reset' && message.nonce === nonce && message.session === session) {
        disconnectHost();
        emit();
        return;
      }
      if (message.k === 'town-welcome' || message.k === 'town-snapshot') {
        if (message.nonce !== nonce || !message.session) return;
        if (message.k === 'town-snapshot' && (!session || message.session !== session)) return;
        if (message.session === session && (message.seq <= received || message.revision < revision)) return;
        const cleaned = validSnapshot(message);
        if (!cleaned) return warn('Invalid town snapshot');
        if (message.session !== session || message.revision !== revision) {
          resetReady();
          revision = message.revision;
          session = message.session;
          dirty = true;
        }
        for (const m of cleaned) if (m.uid !== uid) Object.assign(members.get(m.uid), m);
        received = message.seq;
        lastHost = now();
        emit();
        return;
      }
      if (!session || message.session !== session || message.revision !== revision) return;
      if (message.k === 'town-prepare') {
        if (typeof message.id !== 'string' || !message.id || message.id.length > 100) return warn('Invalid launch identifier');
        const accepted = !launch && ready && menuOpen && pose?.location === 'ready' && game.Game.state === 'ui' && !game.Coop.active;
        if (accepted) launch = { id: message.id, deadline: now() + TIMEOUT, phase: 'prepared' };
        send(room.host, 'town-ack', { id: message.id, accepted, nonce });
      } else if (message.k === 'town-cancel' && launch?.id === message.id) {
        cancelLaunch(true, false);
      }
      emit();
    }

    function updateLocal(value) {
      const next = cleanPose(value);
      if (!next) throw new RangeError('Invalid local town pose');
      syncRoom();
      if (JSON.stringify(pose) !== JSON.stringify(next)) {
        pose = next;
        dirty = true;
        if (pose.location !== 'ready' && menuOpen) setReadyMenuOpen(false);
        localMember();
        emit();
      }
    }

    function setReadyMenuOpen(open) {
      if (menuOpen === !!open) return;
      menuOpen = !!open;
      if (pose) pose = { ...pose, walking: false, location: open ? 'ready' : 'menu' };
      if (!menuOpen) { cancelLaunch(true); setReady(false); }
      dirty = true;
      localMember();
      emit();
    }

    function setReady(value) {
      if (value && (!room || !session || !menuOpen || !pose || game.Game.state !== 'ui' ||
          game.Coop.active || launch || room.lost)) {
        notice('Espera la conexi\u00f3n y abre la sala para prepararte.');
        return false;
      }
      ready = !!value;
      localMember();
      dirty = true;
      if (room?.isHost) publish(true);
      else if (room && session && pose && !send(room.host, 'town-ready', { ready, pose, nonce })) {
        ready = false;
        notice('No se pudo comunicar tu estado. Int\u00e9ntalo de nuevo.');
      }
      emit();
      return ready;
    }

    function requestStart(startNative) {
      syncRoom();
      if (!getSnapshot().canStart || game.Game.state !== 'ui' || game.Coop.active) {
        notice('Todos los jugadores deben estar conectados y preparados.');
        return Promise.resolve(false);
      }
      return new Promise(resolve => {
        launch = { id: token(), phase: 'preparing', acks: new Set([uid]), deadline: now() + TIMEOUT, startNative, resolve };
        broadcast('town-prepare', { id: launch.id });
        emit();
      });
    }

    function getLaunchToken() {
      return launch && now() < launch.deadline && room?.isHost && launch.phase === 'starting' ?
        { session, revision, id: launch.id } : null;
    }

    function acceptStart(message) {
      const proof = message?.townLaunch;
      // Once the host commits a broadcast, it must join that same start.
      if (!room || !launch || !menuOpen || !ready || (!room.isHost && now() >= launch.deadline) ||
          game.Game.state !== 'ui' || message.host !== room.host ||
          !proof || proof.session !== session || proof.revision !== revision || proof.id !== launch.id ||
          (room.isHost && launch.phase !== 'starting') ||
          !Array.isArray(message.members) || message.members.length !== members.size ||
          new Set(message.members.map(m => m.uid)).size !== members.size ||
          message.members.some(m => !members.has(m.uid))) return false;
      launch = null;
      ready = menuOpen = false;
      for (const m of members.values()) m.ready = false;
      if (pose) pose = { ...pose, walking: false, location: 'away' };
      dirty = true;
      localMember();
      emit();
      return true;
    }

    social.on(syncRoom);
    net.on(receive);
    // Native Net has no offPeer; this one lifetime subscription becomes inert on disposal.
    net.onPeer(peerChanged);
    syncRoom();
    return {
      updateLocal, setReadyMenuOpen, setReady, requestStart, getSnapshot, getLaunchToken, acceptStart,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      dispose() {
        cancelLaunch(false);
        disposed = true;
        social.off(syncRoom);
        net.off(receive);
        if (timer !== null) host.clearInterval(timer);
        timer = null;
        members.clear();
        listeners.clear();
      }
    };
  }

  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.PSTownMultiplayer = api;
})();
