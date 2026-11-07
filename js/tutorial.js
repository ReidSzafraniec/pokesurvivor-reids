(function () {
  'use strict';

  const STAGES = Object.freeze(['practice', 'build', 'done']);
  const UPGRADE_COUNT = 2;

  function pending(save) {
    const value = save?.onboarding;
    return value?.version === 1 && STAGES.includes(value.stage) &&
      value.dex === save.starter && !!save.owned?.[value.dex] ? value : null;
  }

  function merge(target, left, right) {
    const candidates = [pending(left), pending(right)].filter(value =>
      value && value.dex === target.starter && target.owned?.[value.dex]);
    if (candidates.length) {
      const best = candidates.reduce((a, b) =>
        STAGES.indexOf(a.stage) >= STAGES.indexOf(b.stage) ? a : b);
      target.onboarding = { ...best };
    } else delete target.onboarding;
    return target;
  }

  function install(game, host = window) {
    const $ = id => host.document.getElementById(id);
    const panel = $('tutorial-panel'), title = $('tutorial-title'), text = $('tutorial-text');
    const skip = $('tutorial-skip'), retry = $('tutorial-retry');
    const levelScreen = $('scr-levelup');
    if (!panel || !title || !text || !skip || !retry) throw new Error('Missing tutorial controls');
    const T = value => game.T(value);
    let session = null;
    const identity = () => game.DB.fb?.uid || game.DB.user || game.DB.save;
    const valid = () => session && session.account === identity() &&
      pending(game.DB.save)?.dex === session.dex;
    const practice = () => valid() && session.phase !== 'build' &&
      pending(game.DB.save).stage === 'practice';
    const activeFor = player => !!(practice() && session.player === player);

    game.I18n.add({
      'Primer combate': 'Your first battle',
      'Moverse y atacar': 'Move and attack',
      'Muévete con WASD o las flechas. Tus ataques se activan automáticamente.':
        'Move with WASD or the arrow keys. Your attacks fire automatically.',
      'Móvil: usa la palanca. Mando: usa la palanca izquierda.':
        'Mobile: use the joystick. Controller: use the left stick.',
      'Vence a los enemigos': 'Defeat enemies',
      'Derrota enemigos con tus ataques automáticos y recoge la XP que dejan para subir de nivel.':
        'Defeat enemies with your automatic attacks and collect their dropped XP to level up.',
      'Recoge la experiencia': 'Collect experience',
      'Acércate al cristal de XP. Al subir de nivel, elige una mejora para esta partida.':
        'Move toward the XP crystal. When you level up, choose an upgrade for this match.',
      'Mejora de partida': 'Match upgrade',
      'Elige una mejora de estadísticas. Solo dura esta partida.':
        'Choose a stat upgrade. It lasts only this match.',
      'La gran oleada': 'The great swarm',
      '¡La oleada no para! Sobrevive todo lo que puedas.':
        'The swarm keeps coming! Survive as long as you can.',
      'Preparar tu compañero': 'Build your partner',
      'Prepara tu compañero y guarda tu primer conjunto de movimientos.':
        'Build your partner and save your first move loadout.',
      'Saltar tutorial y preparar compañero': 'Skip tutorial and build partner',
      'Reintentar guardado': 'Retry save',
      'No se pudo guardar. No cierres el juego.': 'Could not save. Do not close the game.',
      'El tutorial ha cambiado de cuenta. Vuelve a iniciar sesión.':
        'The tutorial account changed. Sign in again.'
    });

    function prompt(heading, body) {
      title.textContent = T(heading);
      text.textContent = body;
      panel.classList.remove('hidden');
    }

    function clearMatch() {
      panel.classList.remove('tutorial-choosing');
      levelScreen.classList.remove('tutorial-levelup');
      game.RunUI.closeLevelUp();
      game.UI.hideAll();
      game.Game.toUI();
      game.EnemyMgr.clear();
      game.Pickups.clear();
      game.Projectiles.clear();
      game.Combat.clearFields();
      game.FX.clear();
      game.Audio.music('village');
    }

    function dispose() {
      const playing = session && session.phase !== 'build';
      session = null;
      panel.classList.add('hidden');
      retry.classList.add('hidden');
      skip.onclick = retry.onclick = null;
      if (playing) clearMatch();
    }

    function commit(next) {
      if (!valid()) return;
      const current = session;
      const saved = game.DB.guest || game.DB.commit();
      if (session !== current || !valid()) return;
      if (!saved) {
        game.UI.toast(T('No se pudo guardar. No cierres el juego.'), 4500);
        panel.classList.remove('hidden');
        retry.classList.remove('hidden');
        retry.onclick = () => commit(next);
        retry.focus();
        return;
      }
      retry.classList.add('hidden');
      next();
    }

    function openBuild() {
      if (!valid()) return;
      session.phase = 'build';
      panel.classList.add('hidden');
      const current = session;
      game.Training.openInitialBuild(session.dex, () => {
        if (session !== current || !valid() || pending(game.DB.save).stage !== 'build') return;
        game.DB.save.onboarding.stage = 'done';
        commit(() => {
          dispose();
          game.Flow.goMenu();
        });
      });
    }

    function finish(reason) {
      if (!['defeat', 'skip'].includes(reason)) throw new RangeError('Invalid tutorial ending');
      if (!practice()) return;
      game.Training.awardTutorial(game.DB.save, session.dex);
      game.DB.save.onboarding.stage = 'build';
      session.phase = 'build';
      clearMatch();
      skip.classList.add('hidden');
      prompt('Preparar tu compañero',
        T('Prepara tu compañero y guarda tu primer conjunto de movimientos.'));
      commit(openBuild);
    }

    function start() {
      const record = pending(game.DB.save);
      if (!record || record.stage !== 'practice') throw new Error('No pending tutorial match');
      if (game.Coop.active) throw new Error('Tutorial must be a solo match');
      dispose();
      session = { account: identity(), dex: record.dex, phase: 'move', player: null,
        distance: 0, x: 0, y: 0, choices: 0, teaching: new WeakSet(), spawned: 0, angle: 0 };
      skip.classList.remove('hidden');
      skip.textContent = T('Saltar tutorial y preparar compañero');
      retry.textContent = T('Reintentar guardado');
      skip.onclick = () => finish('skip');
      game.Game.startRun();
      session.player = game.Game.player;
      session.x = session.player.x;
      session.y = session.player.y;
      prompt('Moverse y atacar', T('Muévete con WASD o las flechas. Tus ataques se activan automáticamente.') +
        ' ' + T('Móvil: usa la palanca. Mando: usa la palanca izquierda.'));
    }

    function resume() {
      const record = pending(game.DB.save);
      if (!record || record.stage === 'done') return false;
      if (record.stage === 'practice') start();
      else {
        dispose();
        session = { account: identity(), dex: record.dex, phase: 'build', player: null };
        openBuild();
      }
      return true;
    }

    function spawn(swarm) {
      const player = session.player;
      const pool = game.Enemies.bagAt(0).filter(enemy =>
        !['healer', 'shielder', 'summoner'].includes(enemy.behavior));
      if (!pool.length) throw new Error('No tutorial enemies available');
      const definition = { ...pool[session.spawned % pool.length] };
      if (swarm) definition.xp = 0;
      // Use ordinary ground enemies, not flying shortcuts through blocked terrain.
      for (let attempt = 0; attempt < 12; attempt++) {
        session.angle += 2.399963229728653;
        const radius = swarm ? Math.max(96, game.Camera.outerRadius()) : 112;
        const x = player.x + Math.cos(session.angle) * radius;
        const y = player.y + Math.sin(session.angle) * radius;
        if (!game.World.isFree(x, y, 16)) continue;
        const pressure = Math.min(2, Math.floor(session.spawned / 64) * 0.2);
        const enemy = new game.Enemy(definition, x, y, swarm
          ? { hp: 3 + pressure * 2, spd: 1.5 + pressure * 0.35, dmg: 4 + pressure * 2 }
          : { hp: 0.5, spd: 0.6, dmg: 0.25 }, false);
        if (!swarm) session.teaching.add(enemy);
        game.EnemyMgr.add(enemy);
        session.spawned++;
        return true;
      }
      return false;
    }

    function update(dt, players, time) {
      if (!activeFor(game.Game.player) || game.Game.state !== 'playing') return;
      const player = session.player;
      if (player.dead) return finish('defeat');
      if (session.phase === 'move') {
        session.distance += Math.min(64, Math.hypot(player.x - session.x, player.y - session.y));
        session.x = player.x;
        session.y = player.y;
        if (session.distance < 64) return;
        session.phase = 'fight';
        prompt('Vence a los enemigos',
          T('Derrota enemigos con tus ataques automáticos y recoge la XP que dejan para subir de nivel.'));
      }
      const swarm = session.phase === 'swarm';
      const live = game.EnemyMgr.all().filter(enemy => !enemy.dead).length;
      const needed = Math.min(8, (swarm ? game.Spawner.CAP : 4) - live);
      for (let i = 0; i < needed; i++) if (!spawn(swarm)) break;
    }

    const originalSpawn = game.Spawner.update;
    game.Spawner.update = function (...args) {
      return practice() ? update(...args) : originalSpawn.apply(this, args);
    };
    for (const name of ['Path', 'Hazards', 'Interact', 'Rift', 'Judgment', 'Events', 'Weather']) {
      const original = game[name].update;
      game[name].update = function (...args) {
        if (!practice()) return original.apply(this, args);
      };
    }
    const originalEvent = game.Progress.event;
    game.Progress.event = function (...args) {
      if (!practice()) return originalEvent.apply(this, args);
    };
    const originalKill = game.Progress.kill;
    game.Progress.kill = function (enemy, ...rest) {
      if (!practice()) return originalKill.call(this, enemy, ...rest);
      if (session.phase !== 'swarm' && enemy?.dead && session.teaching.delete(enemy)) {
        game.Pickups.drop(enemy.xp >= 20 ? 'xpBig' : 'xp', enemy.x, enemy.y, enemy.xp);
        prompt('Recoge la experiencia',
          T('Acércate al cristal de XP. Al subir de nivel, elige una mejora para esta partida.'));
      }
    };
    for (const name of ['checkAch']) {
      const original = game.Progress[name];
      game.Progress[name] = function (...args) {
        if (!practice()) return original.apply(this, args);
      };
    }
    const originalMerge = game.Training.merge;
    game.Training.merge = function (target, left, right) {
      return merge(originalMerge.call(this, target, left, right), left, right);
    };
    const originalDrop = game.Pickups.dropXp;
    game.Pickups.dropXp = function (...args) {
      if (!practice()) return originalDrop.apply(this, args);
    };
    for (const name of ['onRescue', 'onShinyCaught']) {
      const original = game[name];
      if (original) game[name] = function (...args) {
        if (!practice()) return original.apply(this, args);
      };
    }
    const originalLevel = game.RunUI.showLevelUp;
    game.RunUI.showLevelUp = function (level, offers, choose, ...rest) {
      if (!practice()) return originalLevel.call(this, level, offers, choose, ...rest);
      const current = session;
      let picked = false;
      panel.classList.add('tutorial-choosing');
      levelScreen.classList.add('tutorial-levelup');
      prompt('Mejora de partida', '(' + Math.min(UPGRADE_COUNT, session.choices + 1) + '/' + UPGRADE_COUNT + ') ' +
        T('Elige una mejora de estadísticas. Solo dura esta partida.'));
      return originalLevel.call(this, level, offers, offer => {
        if (picked || session !== current || !practice()) return;
        picked = true;
        panel.classList.remove('tutorial-choosing');
        levelScreen.classList.remove('tutorial-levelup');
        choose(offer);
        session.choices++;
        if (session.choices === UPGRADE_COUNT) {
          session.phase = 'swarm';
          game.EnemyMgr.clear();
          game.Pickups.clear();
          prompt('La gran oleada',
            T('¡La oleada no para! Sobrevive todo lo que puedas.'));
        } else {
          prompt('Vence a los enemigos',
            T('Derrota enemigos con tus ataques automáticos y recoge la XP que dejan para subir de nivel.'));
        }
      }, ...rest);
    };

    game.DB.onSync(() => {
      if (!session) return;
      if (!valid()) {
        dispose();
        game.UI.toast(T('El tutorial ha cambiado de cuenta. Vuelve a iniciar sesión.'), 4500);
      } else if (pending(game.DB.save).stage === 'done') {
        clearMatch();
        dispose();
        game.Flow.goMenu();
      } else if (session.phase !== 'build' && pending(game.DB.save).stage === 'build') {
        clearMatch();
        openBuild();
      }
    });
    game.DB.onLeave(dispose);
    const originalVirtual = game.Input.virtual;
    game.Input.virtual = function (code, ...rest) {
      if (valid() && session.phase === 'build' && code === 'escape') return;
      return originalVirtual.call(this, code, ...rest);
    };
    host.addEventListener('keydown', event => {
      if (!valid() || event.ctrlKey || event.altKey || event.metaKey) return;
      const build = session.phase === 'build';
      if (event.code === 'Tab' ||
          (['Enter', 'Space'].includes(event.code) && (build || event.target === skip || event.target === retry)) ||
          (build && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code))) {
        event.stopImmediatePropagation();
      } else if (build && event.code === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    const api = { start, resume, finish, update, activeFor, dispose };
    game.Tutorial = api;
    return api;
  }

  const api = { pending, merge, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.PSTutorial = api;
})();
