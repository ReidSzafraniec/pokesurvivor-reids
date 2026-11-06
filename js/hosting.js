(function () {
  'use strict';

  function create(config, location) {
    let error = '';
    const project = config && config.projectId;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const hosts = project ? [project + '.web.app', project + '.firebaseapp.com', 'localhost', '127.0.0.1'] : [];
    if (!config || !config.apiKey || !config.appId || !project || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) {
      error = 'Firebase hosting configuration is missing or invalid. Complete js/hosting-config.js with your own Firebase web app settings.';
    } else if (project === 'pokesurvivor-free') {
      error = 'Use your own Firebase project, not the original developer\'s project.';
    } else if (!hosts.includes(location.hostname) || !/^https?:$/.test(location.protocol)) {
      error = 'This host is not authorized by the Firebase hosting configuration.';
    } else if (config.emulator && !local) {
      error = 'Firebase emulators may only be used on localhost.';
    } else if (config.authDomain !== project + '.firebaseapp.com') {
      error = 'Firebase authDomain must belong to your project.';
    } else {
      try {
        const url = new URL(config.databaseURL);
        const name = project + '-default-rtdb';
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            url.pathname !== '/' ||
            !(url.hostname === name + '.firebaseio.com' ||
              url.hostname === project + '.firebaseio.com' ||
              new RegExp('^' + name + '\\.[a-z0-9-]+\\.firebasedatabase\\.app$').test(url.hostname))) {
          error = 'Firebase databaseURL must name your project\'s default Realtime Database.';
        }
      } catch {
        error = 'Firebase databaseURL is missing or invalid.';
      }
    }

    return {
      firebase: error ? null : Object.freeze({ ...config }),
      hosts, error,
      async joinRoom(database, roomId, uid, member) {
        const room = database.ref('rooms/' + roomId);
        const slots = (await database.ref('rooms/' + roomId + '/slots').get()).val() || {};
        const seat = Object.keys(slots).find(key => slots[key] === uid);
        const existing = seat !== undefined;
        const memberRef = database.ref('rooms/' + roomId + '/m/' + uid);
        try {
          await memberRef.onDisconnect().remove();
          const candidates = existing ? [seat] : ['1', '2', '3'].filter(key => !slots[key]);
          for (const candidate of candidates) {
            try {
              // Rules reject occupied seats; membership and its seat must appear together.
              await room.update({ ['m/' + uid]: member, ['slots/' + candidate]: uid });
              return;
            } catch (failure) {
              if (!['PERMISSION_DENIED', 'permission-denied'].includes(failure.code)) throw failure;
              const occupant = (await database.ref('rooms/' + roomId + '/slots/' + candidate).get()).val();
              if (!occupant || occupant === uid) throw failure;
            }
          }
          throw new Error('Room is full (maximum 4 players).');
        } catch (failure) {
          if (!existing) {
            try { await memberRef.onDisconnect().cancel(); }
            catch (cleanup) { throw new AggregateError([failure, cleanup], 'Room join and disconnect cleanup failed.'); }
          }
          throw failure;
        }
      },
      async releaseSeat(database, roomId, uid, cancelDisconnect = true) {
        const slots = (await database.ref('rooms/' + roomId + '/slots').get()).val() || {};
        const seat = Object.keys(slots).find(key => slots[key] === uid);
        if (seat !== undefined) {
          const room = database.ref('rooms/' + roomId);
          await room.update({ ['m/' + uid]: null, ['slots/' + seat]: null });
          if (cancelDisconnect) await room.onDisconnect().cancel();
        }
      },
      async releaseDepartedSeats(database, roomId, previous, current) {
        const departed = previous.filter(member => !current[member.uid]).map(member => member.uid);
        if (!departed.length) return;
        const slots = (await database.ref('rooms/' + roomId + '/slots').get()).val() || {};
        for (const [seat, uid] of Object.entries(slots)) {
          if (seat !== '0' && departed.includes(uid)) {
            const member = await database.ref('rooms/' + roomId + '/m/' + uid).get();
            if (!member.exists()) await database.ref('rooms/' + roomId + '/slots/' + seat).remove();
          }
        }
      },
      install(game) {
        if (error) {
          console.error('[Hosting]', error);
          const boot = document.getElementById('boot');
          boot.replaceChildren();
          const message = document.createElement('p');
          message.textContent = error;
          boot.appendChild(message);
          return false;
        }
        game.I18n.add({
          'El ranking verificado no est\u00e1 disponible en esta versi\u00f3n.':
            'The verified leaderboard is not available on this version.'
        });
        game.RankingUI.open = () => game.UI.toast(game.T('El ranking verificado no est\u00e1 disponible en esta versi\u00f3n.'), 4000);
        return true;
      },
      ranking() {
        return {
          PERIODS: [],
          periodIds(now = new Date()) {
            const day = now.toISOString().slice(0, 10);
            const monday = new Date(day + 'T00:00:00Z');
            monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
            return { d: day, w: monday.toISOString().slice(0, 10) };
          },
          isAdmin: () => false,
          mySeal: () => null, newSeal() {}, beat() {}, runStarted() {},
          submitSolo() {}, submitGroup() {}, removeMine: async () => {}
        };
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else window.PSHosting = create(window.PS_FIREBASE_CONFIG, window.location);
})();
