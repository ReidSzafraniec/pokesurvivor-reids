(function () {
  'use strict';

  const START_LEVEL = 1, MAX_LEVEL = 100, MAX_MOVES = 4;
  const EARLY_LEVEL = 10, EARLY_POINTS = 600;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

  function create(data) {
    let game, activeRun, selectedDex, evolving, gentleEvolution;
    let baseMonFor;
    const statOrigins = new WeakMap();
    let startFromTraining = false, returnToLobby = false, activeTab = 'moves';
    const statLabels = {
      hp: 'HP', pa: 'Ataque', sa: 'Ataque especial', df: 'Defensa',
      sd: 'Defensa especial', spd: 'Velocidad'
    };

    function species(dex) {
      if (!Object.hasOwn(data.pokemon, dex)) throw new RangeError('Unknown Pokemon: ' + dex);
      return data.pokemon[dex];
    }

    function xpAt(dex, level) {
      if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
        throw new RangeError('Pokemon levels must be between 1 and 100');
      }
      return data.growth[species(dex).growth][level];
    }

    function levelAt(dex, xp) {
      let level = START_LEVEL;
      while (level < MAX_LEVEL && xp >= xpAt(dex, level + 1)) level++;
      return level;
    }

    const attack = id => id === 'struggle' || (data.moves[id] && !data.moves[id].support);

    function learnedTms(save, dex) {
      const taught = Array.isArray(save.ptm?.[dex]) ? save.ptm[dex] : [];
      return [...new Set(taught.filter(id => species(dex).tms.includes(id)))];
    }

    function inheritedMoves(dex, level, ids) {
      const allowed = new Set();
      for (let parent = species(dex).prevo; parent; parent = species(parent).prevo) {
        for (const [id, at] of species(parent).moves) if (at <= level) allowed.add(id);
        for (const id of species(parent).tms) allowed.add(id);
      }
      return Array.isArray(ids) ? [...new Set(ids.filter(id => allowed.has(id)))] : [];
    }

    function eligible(save, dex, level, inherited = save.training?.[dex]?.inherited) {
      const ids = [...new Set(species(dex).moves.filter(([, at]) => at <= level)
        .map(([id]) => id).concat(learnedTms(save, dex), inheritedMoves(dex, level, inherited)))];
      // Some species have no implemented attack yet. This is a visible combat
      // fallback, never a fabricated entry in that species' official learnset.
      if (!ids.some(attack)) ids.unshift('struggle');
      return ids;
    }

    function defaultLoadout(save, dex, allowed) {
      const bindings = Array.isArray(save.pbind?.[dex]) ? save.pbind[dex] : [];
      const old = [save.pstart?.[dex], save.pstart2?.[dex], ...bindings];
      const ids = [...new Set(old.concat(allowed).filter(id => allowed.includes(id)))];
      const firstAttack = ids.find(attack);
      return [firstAttack, ...ids.filter(id => id !== firstAttack)].slice(0, MAX_MOVES);
    }

    function cleanRecord(save, dex, entry) {
      entry = object(entry) ? entry : {};
      const epoch = integer(save.rvk?.owned?.[dex]);
      if (integer(entry.epoch) !== epoch) entry = {};
      const xp = Math.max(xpAt(dex, START_LEVEL), Math.min(xpAt(dex, MAX_LEVEL), integer(entry.xp)));
      const level = levelAt(dex, xp), inherited = inheritedMoves(dex, level, entry.inherited);
      const allowed = eligible(save, dex, level, inherited);
      let loadout = Array.isArray(entry.loadout)
        ? [...new Set(entry.loadout.filter(id => allowed.includes(id)))].slice(0, MAX_MOVES) : [];
      if (!loadout.some(attack)) loadout = defaultLoadout(save, dex, allowed);
      return {
        xp, loadout, updated: integer(entry.updated), inherited, epoch,
        evolutionLevel: Math.min(level, integer(entry.evolutionLevel))
      };
    }

    function normalize(save) {
      for (const key of ['owned', 'shiny']) {
        for (const dex of Object.keys(save.rvk?.[key] || {})) {
          if (save[key]?.[dex] && integer(save[key][dex].at) <= integer(save.rvk[key][dex])) {
            delete save[key][dex];
          }
        }
      }
      if (!object(save.training)) save.training = {};
      for (const dex of Object.keys(save.training)) {
        if (!Object.hasOwn(data.pokemon, dex) || !save.owned?.[dex]) delete save.training[dex];
        else save.training[dex] = cleanRecord(save, dex, save.training[dex]);
      }
      if (save.partner && !save.owned?.[save.partner]) {
        save.partner = save.owned?.[save.starter] ? save.starter : +Object.keys(save.owned || {})[0] || null;
        save.partnerShiny = !!save.partnerShiny && !!save.shiny?.[save.partner];
      }
      return save;
    }

    function record(save, dex) {
      species(dex);
      if (!save.owned?.[dex]) throw new RangeError('Train an owned Pokemon');
      if (!object(save.training)) save.training = {};
      return (save.training[dex] = cleanRecord(save, dex, save.training[dex]));
    }

    function state(save, dex) {
      const entry = record(save, dex), level = levelAt(dex, entry.xp);
      const floor = xpAt(dex, level), next = level < MAX_LEVEL ? xpAt(dex, level + 1) : floor;
      return {
        xp: entry.xp, level, current: entry.xp - floor, next: next - floor,
        remaining: next - entry.xp, loadout: entry.loadout.slice(),
        progress: level === MAX_LEVEL ? 1 : (entry.xp - floor) / (next - floor),
        version: data.versions[species(dex).version]
      };
    }

    function available(save, dex) {
      return eligible(save, dex, state(save, dex).level);
    }

    function statsFor(dex) {
      const baseline = baseMonFor(dex);
      if (!baseline || !game.DB.save?.owned[dex]) return baseline;
      const fraction = (state(game.DB.save, dex).level - 1) / (MAX_LEVEL - 1);
      const factor = 1 + 0.5 * fraction;
      const mon = { ...baseline };
      for (const key of ['hp', 'pa', 'sa', 'df', 'sd']) mon[key] *= factor;
      mon.spd *= 1 + 0.15 * fraction;
      mon.atk = Math.max(mon.pa, mon.sa);
      statOrigins.set(mon, { baseline, factor });
      return mon;
    }

    function setLoadout(save, dex, ids, now = Date.now()) {
      const allowed = available(save, dex);
      if (!Array.isArray(ids) || !ids.length || ids.length > MAX_MOVES ||
          new Set(ids).size !== ids.length || ids.some(id => !allowed.includes(id)) ||
          !ids.some(attack)) {
        throw new RangeError('Choose up to four different unlocked moves, including an attack');
      }
      const entry = record(save, dex);
      entry.loadout = ids.slice();
      entry.updated = Math.max(integer(now), entry.updated + 1);
      return state(save, dex);
    }

    function reward({ time, kills, bosses }) {
      if (![time, kills, bosses].every(value => Number.isFinite(value) && value >= 0) ||
          !Number.isSafeInteger(kills) || !Number.isSafeInteger(bosses)) {
        throw new RangeError('Invalid match performance');
      }
      // The defeat bonus grows with survival time, but sublinearly with kill rate.
      const earned = Math.floor(time / 2 + Math.sqrt(time * kills) / 4 + bosses * 15);
      if (!Number.isSafeInteger(earned)) throw new RangeError('Match XP exceeds the supported range');
      return earned;
    }

    function learningMultiplier(save, dex) {
      return 1 + 0.05 * Math.min(8, integer(save.pupg?.[dex]?.xp));
    }

    function award(save, dex, performance, multiplier = learningMultiplier(save, dex)) {
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1.4) {
        throw new RangeError('Invalid purchased learning multiplier');
      }
      const before = state(save, dex), previous = available(save, dex);
      let points = reward(performance) * multiplier, xp = before.xp;
      if (!Number.isFinite(points) || points > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Match XP exceeds the supported range');
      }
      // Convert performance points at each crossed level, keeping saved official XP intact.
      let level = before.level;
      while (points > 0 && level < MAX_LEVEL) {
        const rate = level < EARLY_LEVEL ? Math.max(1, xpAt(dex, EARLY_LEVEL) / EARLY_POINTS)
          : 1 + (level - EARLY_LEVEL) / 3;
        const nextLevel = level < EARLY_LEVEL ? EARLY_LEVEL : level + 1;
        const next = xpAt(dex, nextLevel), needed = (next - xp) / rate;
        if (points < needed) {
          xp += Math.floor(points * rate);
          break;
        }
        xp = next;
        points -= needed;
        level = nextLevel;
      }
      record(save, dex).xp = xp;
      const after = state(save, dex);
      return {
        dex: +dex, earned: after.xp - before.xp, gained: after.xp - before.xp, before, after,
        unlocked: available(save, dex).filter(id => id !== 'struggle' && !previous.includes(id)),
        evolution: after.level > before.level ? pendingEvolution(save, dex) : null
      };
    }

    function pendingEvolution(save, dex) {
      const entry = record(save, dex), level = levelAt(dex, entry.xp);
      if (entry.evolutionLevel >= level) return null;
      const options = species(dex).evolutions.filter(([target, at]) =>
        at <= level && (!game || game.SPRITE_META[target]));
      if (!options.length) return null;
      return { dex: +dex, target: options[0][0], minimum: options[0][1], level };
    }

    function cancelEvolution(save, dex) {
      const pending = pendingEvolution(save, dex);
      if (!pending) throw new RangeError('This Pokemon is not ready to evolve');
      record(save, dex).evolutionLevel = pending.level;
      return pending;
    }

    function evolve(save, dex, target, now = Date.now()) {
      const pending = pendingEvolution(save, dex);
      if (!pending || pending.target !== +target) throw new RangeError('This evolution is not available');
      const source = record(save, dex), existing = save.owned[target] ? record(save, target) : null;
      const at = Math.max(integer(now), integer(save.owned[dex].at) + 1,
        integer(save.rvk?.owned?.[dex]) + 1, integer(save.rvk?.owned?.[target]) + 1,
        source.updated + 1, (existing?.updated || 0) + 1);
      const before = state(save, dex), floor = xpAt(target, before.level);
      const carriedXp = species(dex).growth === species(target).growth ? before.xp :
        before.level === MAX_LEVEL ? floor : floor +
          Math.floor(before.progress * (xpAt(target, before.level + 1) - floor));
      const inherited = [...new Set((existing?.inherited || []).concat(available(save, dex)))];
      save.owned[target] = { at, from: 'evolution' };
      save.training[target] = cleanRecord(save, target, {
        xp: Math.max(carriedXp, existing?.xp || 0), loadout: source.loadout,
        inherited, updated: at, epoch: integer(save.rvk?.owned?.[target]),
        evolutionLevel: existing?.evolutionLevel || 0
      });
      if (!object(save.shiny)) save.shiny = {};
      if (save.shiny[dex]) save.shiny[target] = { at, from: 'evolution' };
      if (!object(save.pupg)) save.pupg = {};
      save.pupg[target] = { ...save.pupg[target] };
      for (const [id, value] of Object.entries(save.pupg[dex] || {})) {
        save.pupg[target][id] = Math.max(integer(value), integer(save.pupg[target][id]));
      }
      for (const key of ['pnat', 'pabil']) {
        if (Array.isArray(save[key]?.[dex])) save[key][target] = [save[key][dex][0], at];
      }
      if (!object(save.ptm)) save.ptm = {};
      save.ptm[target] = [...new Set((save.ptm[target] || []).concat(learnedTms(save, dex)))]
        .filter(id => species(target).tms.includes(id));
      if (save.dfav?.[dex] && Math.abs(save.dfav[dex]) >= Math.abs(save.dfav[target] || 0)) {
        save.dfav[target] = save.dfav[dex];
      }
      if (save.pused?.[dex]) {
        save.pused[target] = Math.max(integer(save.pused[dex]), integer(save.pused[target]));
      }
      if (save.partner === +dex) save.partner = +target;
      if (save.starter === +dex) save.starter = +target;
      if (Array.isArray(save.profile?.favs)) {
        save.profile.favs = [...new Set(save.profile.favs.map(id => +id === +dex ? +target : id))];
      }
      if (!object(save.rvk)) save.rvk = {};
      for (const key of ['owned', 'shiny']) {
        if (!object(save.rvk[key])) save.rvk[key] = {};
        save.rvk[key][dex] = at;
      }
      for (const key of ['owned', 'shiny', 'training', 'pupg', 'ptm', 'pnat', 'pabil',
        'dfav', 'pused', 'pstart', 'pstart2', 'pbind', 'pban', 'pskin']) {
        if (object(save[key])) delete save[key][dex];
      }
      return { ...pending, before, after: state(save, target) };
    }

    function isBase(dex) {
      return !species(dex).prevo;
    }

    function baseOf(dex) {
      while (species(dex).prevo) dex = species(dex).prevo;
      return +dex;
    }

    function gachaEligible(mon, banner) {
      return isBase(mon.dex) && !!game.SPRITE_META[mon.dex] &&
        (banner === game.Gacha.SPOOKY.gen ? mon.types.includes('ghost') : mon.gen === banner);
    }

    function gachaCollection(save, banner) {
      const pool = game.DEX.filter(mon => gachaEligible(mon, banner));
      const owned = new Set(Object.keys(save.owned || {}).map(baseOf));
      const shiny = new Set(Object.keys(save.shiny || {}).map(baseOf));
      return {
        have: pool.filter(mon => owned.has(mon.dex)).length, total: pool.length,
        shiny: pool.filter(mon => shiny.has(mon.dex)).length
      };
    }

    function gachaPool(rarity, banner) {
      for (let distance = 0; distance < 5; distance++) {
        for (const tier of distance ? [rarity + distance, rarity - distance] : [rarity]) {
          if (tier < 1 || tier > 5) continue;
          const list = game.Gacha.pool(tier, banner);
          if (list.length) return { rarity: tier, list };
        }
      }
      throw new Error('No base Pokemon are available for gacha banner: ' + banner);
    }

    function gachaRates(banner) {
      const rates = new Map(game.Gacha.RATES.map(([tier]) => [tier, 0]));
      for (const [tier, rate] of game.Gacha.RATES) {
        const actual = gachaPool(tier, banner).rarity;
        rates.set(actual, rates.get(actual) + rate);
      }
      return [...rates];
    }

    function mergeOwnership(target, left, right) {
      const keys = ['pupg', 'ptm', 'pnat', 'pabil', 'dfav', 'pused', 'pskin',
        'pstart', 'pstart2', 'pbind', 'pban'];
      const sources = [left, right].map(save => ({
        owned: { ...save.owned }, revoked: { ...save.rvk?.owned },
        maps: Object.fromEntries(keys.map(key => [key, { ...save[key] }]))
      }));
      if (!object(target.rvk)) target.rvk = {};
      for (const key of ['owned', 'shiny']) {
        const collections = [target, left, right].map(save => ({ ...save[key] }));
        const revoked = target.rvk[key] = { ...target.rvk[key] };
        for (const save of [left, right]) {
          for (const [dex, at] of Object.entries(save.rvk?.[key] || {})) {
            revoked[dex] = Math.max(integer(revoked[dex]), integer(at));
          }
        }
        target[key] = {};
        for (const dex of new Set(collections.flatMap(value => Object.keys(value)))) {
          const valid = collections.map(value => value[dex]).filter(value =>
            object(value) && (!integer(revoked[dex]) || integer(value.at) > integer(revoked[dex])));
          valid.sort((a, b) => integer(a.at) - integer(b.at));
          if (valid.length) target[key][dex] = { ...valid[0] };
        }
      }
      for (const [dex, at] of Object.entries(target.rvk.owned)) {
        if (!integer(at)) continue;
        const live = sources.filter(source => integer(source.owned[dex]?.at) > at &&
          integer(source.revoked[dex]) === at);
        for (const key of keys) {
          if (!object(target[key])) target[key] = {};
          delete target[key][dex];
          const values = live.map(source => source.maps[key][dex]).filter(value => value !== undefined);
          if (!values.length) continue;
          if (key === 'pupg') {
            const upgrades = target[key][dex] = {};
            for (const value of values) {
              for (const [id, count] of Object.entries(value)) {
                upgrades[id] = Math.max(integer(upgrades[id]), integer(count));
              }
            }
          } else if (key === 'ptm') {
            target[key][dex] = [...new Set(values.flat())];
          } else if (key === 'pused') {
            target[key][dex] = Math.max(...values.map(integer));
          } else if (key === 'dfav') {
            target[key][dex] = values.sort((a, b) => Math.abs(b) - Math.abs(a))[0];
          } else {
            values.sort((a, b) => (Array.isArray(b) ? integer(b[1]) : 0) -
              (Array.isArray(a) ? integer(a[1]) : 0) || JSON.stringify(b).localeCompare(JSON.stringify(a)));
            target[key][dex] = values[0];
          }
        }
      }
    }

    function merge(target, left, right) {
      const a = object(left.training) ? left.training : {};
      const b = object(right.training) ? right.training : {};
      // The legacy collection merge keeps the oldest acquisition. After an
      // evolution, only acquisitions newer than its tombstone can survive.
      mergeOwnership(target, left, right);
      normalize(target);
      target.training = {};
      for (const dex of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!Object.hasOwn(data.pokemon, dex) || !target.owned?.[dex]) continue;
        const x = cleanRecord(target, dex, a[dex]), y = cleanRecord(target, dex, b[dex]);
        const latest = x.updated === y.updated
          ? (JSON.stringify(x.loadout) >= JSON.stringify(y.loadout) ? x : y)
          : (x.updated > y.updated ? x : y);
        target.training[dex] = cleanRecord(target, dex, {
          xp: Math.max(x.xp, y.xp), loadout: latest.loadout, updated: latest.updated,
          inherited: [...new Set(x.inherited.concat(y.inherited))], epoch: x.epoch,
          evolutionLevel: Math.max(x.evolutionLevel, y.evolutionLevel)
        });
      }
      return target;
    }

    function temporaryOffers(stats, player, pickN, count = 3) {
      return pickN(stats.filter(stat => !stat.max || (player.statsTaken[stat.id] || 0) < stat.max), count)
        .map(stat => ({
          type: 'stat', key: 'stat:' + stat.id, icon: stat.icon, color: '#8fa3c4',
          title: stat.title, desc: stat.desc,
          apply(target) {
            stat.apply(target);
            target.statsTaken[stat.id] = (target.statsTaken[stat.id] || 0) + 1;
          }
        }));
    }

    const $ = id => document.getElementById(id);
    const text = value => game.T(value);
    const number = value => value.toLocaleString(game.I18n.locale);
    const moveName = id => game.T(game.Moves.BY_ID[id].name, 'move');
    const escape = value => game.U.esc(value);

    function saveChanges() {
      if (game.DB.guest) return true;
      if (!game.DB.commit()) {
        game.UI.toast(text('No se pudo guardar. No cierres el juego.'), 4500);
        return false;
      }
      return true;
    }

    function buyPerk(dex, id) {
      if (game.Game.state !== 'ui') throw new RangeError('Buy perks between matches');
      const save = game.DB.save;
      if (!save.owned[dex]) throw new RangeError('Train an owned Pokemon');
      const perk = game.Upgrades.LIST.find(entry => entry.id === id);
      if (!perk) throw new RangeError('Choose an available utility perk');
      const rank = Math.min(perk.max, integer(save.pupg?.[dex]?.[id]));
      if (rank === perk.max) throw new RangeError('This perk is already at its maximum');
      const cost = game.Upgrades.cost(id, rank);
      if (integer(save.coins) < cost) throw new RangeError('Not enough coins');
      if (!object(save.pupg)) save.pupg = {};
      if (!object(save.pupg[dex])) save.pupg[dex] = {};
      save.coins -= cost;
      save.pupg[dex][id] = rank + 1;
      game.UI.refreshCoins();
      return saveChanges();
    }

    function checkItemChange(dex) {
      if (game.Game.state !== 'ui') throw new RangeError('Use training items between matches');
      if (!game.DB.save.owned[dex]) throw new RangeError('Train an owned Pokemon');
    }

    function useNature(dex, id) {
      checkItemChange(dex);
      if (!Object.hasOwn(game.NATURE_BY, id) || game.Mons.natureOf(dex).id === id) {
        throw new RangeError('Choose a different nature');
      }
      if (!game.Shop.take('mint')) throw new RangeError('Missing required training item');
      game.Mons.setNature(dex, id);
      return saveChanges();
    }

    function useAbility(dex, slot, item) {
      checkItemChange(dex);
      if (!['cap', 'caph'].includes(item) ||
          !game.Mons.abilityChoices(dex, item === 'caph').includes(slot)) {
        throw new RangeError('Choose an available ability');
      }
      if (!game.Shop.take(item)) throw new RangeError('Missing required training item');
      game.Mons.setAbility(dex, slot);
      return saveChanges();
    }

    function dismissEvolution() {
      if (!evolving) return;
      clearTimeout(evolving.timer);
      evolving = null;
      $('scr-evolution').classList.add('hidden');
    }

    function interruptEvolution() {
      const session = evolving;
      dismissEvolution();
      game.UI.toast(text('El progreso ha cambiado. Revisa la evoluci\u00f3n de nuevo.'), 4500);
      if (game.DB.save && game.Game.state === 'ui') game.MenuUI.open();
      else if (game.DB.save === session.save && game.Game.state === 'over') {
        const dex = [session.currentDex, session.dex, session.target, session.save.partner]
          .find(id => session.save.owned[id]);
        session.done(dex);
      }
    }

    function openEvolution(dex, done) {
      if (game.Game.state !== 'over') {
        throw new Error('Pokemon evolutions are only available on the match XP results screen');
      }
      const pending = pendingEvolution(game.DB.save, dex);
      if (!pending) return done(+dex);
      if (evolving) throw new Error('An evolution is already in progress');
      const save = game.DB.save, session = { ...pending, save, done };
      evolving = session;
      const screen = $('scr-evolution'), stage = $('evolution-stage');
      const stop = $('evolution-stop'), next = $('evolution-continue');
      const soft = $('evolution-soft');
      const name = game.DEX_BY[dex].name, targetName = game.DEX_BY[pending.target].name;
      game.UI.show('scr-evolution');
      $('evolution-title').textContent = text('Evoluci\u00f3n');
      $('evolution-message').textContent = name + ' ' + text('est\u00e1 evolucionando...');
      $('evolution-level').textContent = text('Nivel permanente') + ' ' + pending.level +
        ' \u00b7 ' + text('Evoluciona al nivel') + ' ' + pending.minimum;
      stop.classList.remove('hidden');
      next.classList.add('hidden');
      stage.classList.add('evolution-running');
      soft.checked = gentleEvolution ??
        (window.matchMedia('(prefers-reduced-motion: reduce)').matches || game.Settings.get('calm'));
      stage.classList.toggle('evolution-soft', soft.checked);
      soft.onchange = () => {
        gentleEvolution = soft.checked;
        stage.classList.toggle('evolution-soft', soft.checked);
      };
      const shiny = +dex === save.partner && !!save.partnerShiny && !!save.shiny?.[dex];
      for (const [id, mon] of [['evolution-before', +dex], ['evolution-after', pending.target]]) {
        game.UI.sprite($(id), mon, { scale: 4, hero: true, shadow: false, shiny });
      }

      function finish(cancelled) {
        if (evolving !== session || session.finished) return;
        if (game.DB.save !== save || !save.owned[dex] ||
            pendingEvolution(save, dex)?.level !== pending.level ||
            game.Game.state !== 'over') {
          interruptEvolution();
          return;
        }
        clearTimeout(session.timer);
        session.finished = true;
        stage.classList.remove('evolution-running');
        stage.classList.toggle('evolution-complete', !cancelled);
        stop.classList.add('hidden');
        next.classList.remove('hidden');
        if (cancelled) {
          cancelEvolution(save, dex);
          session.currentDex = +dex;
          $('evolution-message').textContent = name + ' ' + text('ha dejado de evolucionar.');
          $('evolution-level').textContent = pending.level < MAX_LEVEL
            ? text('Volver\u00e1 a intentarlo al siguiente nivel.') + ' (' + (pending.level + 1) + ')'
            : text('Nivel m\u00e1ximo');
          game.Audio.sfx('select');
        } else {
          evolve(save, dex, pending.target);
          session.currentDex = pending.target;
          $('evolution-message').textContent = name + ' \u2192 ' + targetName + '!';
          $('evolution-level').textContent = text('Nivel permanente') + ' ' +
            state(save, pending.target).level;
          game.Audio.sfx('confirm');
          game.Progress.checkAch();
        }
        saveChanges();
        next.focus();
      }

      stage.classList.remove('evolution-complete');
      stop.onclick = () => finish(true);
      next.onclick = () => {
        if (evolving !== session || !session.finished) return;
        const current = session.currentDex;
        dismissEvolution();
        openEvolution(current, done);
        if (!evolving) document.querySelector('.scr:not(.hidden) button:not([disabled])')?.focus();
      };
      screen.onkeydown = event => {
        if (event.key === 'Escape' || event.key.toLowerCase() === 'b') {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
        } else if (event.key === 'Tab') {
          const controls = session.finished ? [soft, next] : [soft, stop];
          if (event.shiftKey && document.activeElement === controls[0]) {
            event.preventDefault();
            controls[1].focus();
          } else if (!event.shiftKey && document.activeElement === controls[1]) {
            event.preventDefault();
            controls[0].focus();
          }
        }
      };
      stop.focus();
      game.Audio.sfx('select');
      session.timer = setTimeout(() => finish(false), 4800);
    }

    function evolutionHint(dex) {
      const next = species(dex).evolutions.find(([target]) => game.SPRITE_META[target]);
      if (next) return text('Evoluciona al nivel') + ' ' + next[1] + ': ' + game.DEX_BY[next[0]].name;
      return Object.values(data.pokemon).some(mon => mon.prevo === +dex)
        ? text('Su m\u00e9todo especial de evoluci\u00f3n a\u00fan no est\u00e1 disponible.') : '';
    }

    function progressHtml(dex) {
      const value = state(game.DB.save, dex);
      return '<b>' + text('Nivel permanente') + ' ' + value.level + '</b>' +
        '<progress class="training-xp" max="1" value="' + value.progress + '" aria-label="' +
        text('Experiencia permanente') + '"></progress><small>' +
        (value.level === MAX_LEVEL ? text('Nivel m\u00e1ximo') : number(value.current) + ' / ' +
          number(value.next) + ' XP') + '</small>';
    }

    function renderMenu() {
      const save = game.DB.save;
      if (save?.partner && save.owned[save.partner]) {
        $('menu-training-progress').innerHTML = progressHtml(save.partner);
      }
    }

    function sourceName(value) {
      const names = {
        'scarlet-violet': 'Scarlet / Violet',
        'the-teal-mask': 'Scarlet / Violet: The Teal Mask',
        'the-indigo-disk': 'Scarlet / Violet: The Indigo Disk',
        'brilliant-diamond-shining-pearl': 'Brilliant Diamond / Shining Pearl',
        'legends-arceus': 'Legends: Arceus',
        'sword-shield': 'Sword / Shield',
        'the-crown-tundra': 'Sword / Shield: The Crown Tundra',
        'the-isle-of-armor': 'Sword / Shield: The Isle of Armor',
        'ultra-sun-ultra-moon': 'Ultra Sun / Ultra Moon',
        'lets-go-pikachu-lets-go-eevee': "Let's Go Pikachu / Eevee"
      };
      return names[value] || value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    }

    function showTab(tab, focus = false) {
      activeTab = tab;
      for (const id of ['moves', 'perks']) {
        const selected = id === tab, button = $('training-tab-' + id);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        $('training-panel-' + id).classList.toggle('hidden', !selected);
        if (selected && focus) button.focus();
      }
    }

    function renderSelector() {
      const save = game.DB.save, select = $('training-mon');
      select.replaceChildren();
      for (const id of Object.keys(save.owned).map(Number).filter(id => game.DEX_BY[id])) {
        select.append(new Option(game.DEX_BY[id].name + ' - ' + text('Nivel') + ' ' +
          state(save, id).level, id));
      }
      select.value = selectedDex;
      select.disabled = startFromTraining;
      select.onchange = () => { selectedDex = +select.value; render(); };
    }

    function natureEffect(nature) {
      return nature.up ? '+' + text(statLabels[nature.up]) + ' / -' + text(statLabels[nature.down])
        : text('Neutral');
    }

    function applyTrainingChange(action) {
      try {
        if (action()) game.Audio.sfx('buy');
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        game.UI.toast(text('No se pudo aplicar. Revisa tus monedas, objetos y l\u00edmites.'), 3500);
      }
      render();
    }

    function renderStats(dex) {
      const mon = statsFor(dex), nature = game.Mons.natureOf(dex);
      $('training-stats').innerHTML = Object.entries(statLabels).map(([key, label]) => {
        const modifier = nature.up === key ? ' nat-up' : nature.down === key ? ' nat-down' : '';
        const value = ['pa', 'sa'].includes(key) ? '\u00d7' + mon[key].toFixed(2) : number(Math.round(mon[key]));
        return '<div class="training-stat' + modifier + '"><span>' + escape(text(label)) +
          (nature.up === key ? ' +10%' : nature.down === key ? ' -10%' : '') +
          '</span><b>' + value + '</b></div>';
      }).join('');
      $('training-nature').textContent = text('Naturaleza') + ': ' +
        game.Mons.name(nature.n) + ' (' + natureEffect(nature) + ')';
      const ability = game.Mons.abilityOf(dex);
      $('training-ability').textContent = text('Habilidad') + ': ' +
        (game.Mons.abilityName(ability.id) || text('Sin habilidad'));
      const effect = ability.id ? game.AbilityFX.of(ability.id, mon) : null;
      $('training-ability-effect').textContent = effect ?
        [effect.d, effect.d2].filter(Boolean).map(value => text(value)).join(' ') : '';
      const select = $('training-nature-select');
      select.replaceChildren();
      for (const option of game.NATURES) {
        if (option.id !== nature.id) select.append(new Option(game.Mons.name(option.n) +
          ' (' + natureEffect(option) + ')', option.id));
      }
      $('training-mint').disabled = !game.Shop.count('mint');
      $('training-mint').textContent = text('Usar Menta') + ' (' + game.Shop.count('mint') + ')';
      $('training-mint').onclick = () => applyTrainingChange(() => useNature(dex, select.value));
      for (const item of ['cap', 'caph']) {
        const choices = game.Mons.abilityChoices(dex, item === 'caph'), picker = $('training-' + item + '-select');
        picker.replaceChildren();
        for (const slot of choices) {
          picker.append(new Option(game.Mons.abilityName(game.Mons.slots(dex)[slot]) +
            (slot === 2 ? ' (' + text('oculta') + ')' : ''), slot));
        }
        const button = $('training-' + item);
        button.disabled = !choices.length || !game.Shop.count(item);
        button.textContent = text(item === 'cap' ? 'Usar C\u00e1psula' : 'Usar C\u00e1psula oculta') +
          ' (' + game.Shop.count(item) + ')';
        button.onclick = () => applyTrainingChange(() => useAbility(dex, +picker.value, item));
      }
    }

    function renderPerks(dex) {
      const save = game.DB.save, list = $('training-perks');
      $('training-coins').textContent = text('Pok\u00e9monedas') + ': ' + number(integer(save.coins));
      list.replaceChildren();
      for (const perk of game.Upgrades.LIST) {
        const rank = Math.min(perk.max, integer(save.pupg?.[dex]?.[perk.id]));
        const maxed = rank === perk.max, cost = maxed ? 0 : game.Upgrades.cost(perk.id, rank);
        const row = document.createElement('div'), info = document.createElement('div');
        row.className = 'panel upg-item training-perk';
        const icon = document.createElement('div');
        icon.className = 'ic';
        icon.innerHTML = game.Icons.html(perk.icon, 28);
        info.innerHTML = '<b>' + escape(text(perk.name)) + '</b><small>' + escape(text(perk.unit)) +
          '</small><small>' + text('Nivel') + ' ' + rank + ' / ' + perk.max + '</small>';
        const button = document.createElement('button');
        button.id = 'training-perk-' + perk.id;
        button.className = 'btn small';
        button.disabled = maxed || integer(save.coins) < cost;
        button.textContent = maxed ? text('Nivel m\u00e1ximo') : text('Comprar') + ' \u00b7 ' + number(cost);
        button.setAttribute('aria-label', text(perk.name) + ': ' + button.textContent);
        button.onclick = () => {
          applyTrainingChange(() => buyPerk(dex, perk.id));
          $('training-perk-' + perk.id).focus();
        };
        row.append(icon, info, button);
        list.append(row);
      }
    }

    function render() {
      const save = game.DB.save, dex = selectedDex;
      const mon = game.DEX_BY[dex], value = state(save, dex), allowed = available(save, dex);
      renderSelector();
      renderStats(dex);
      renderPerks(dex);
      showTab(activeTab);
      $('training-name').textContent = mon.name;
      $('training-progress').innerHTML = progressHtml(dex);
      $('training-source').textContent = text('Datos de movimientos') + ': ' + sourceName(value.version);
      $('training-evolution').textContent = evolutionHint(dex);
      $('training-guest').classList.toggle('hidden', !game.DB.guest);
      $('training-fallback').classList.toggle('hidden', !allowed.includes('struggle'));
      $('training-play').classList.toggle('hidden', !startFromTraining);
      game.UI.sprite($('training-stage'), dex, {
        lively: true, scale: 3, hero: true,
        shiny: dex === save.partner && !!save.partnerShiny && game.DB.ownsShiny(dex),
        skin: game.Skins.worn(save, dex)
      });

      const slots = $('training-slots');
      slots.replaceChildren();
      for (let slot = 0; slot < MAX_MOVES; slot++) {
        const label = document.createElement('label'), select = document.createElement('select');
        label.className = 'training-slot';
        label.append(text('Movimiento') + ' ' + (slot + 1));
        select.className = 'field';
        select.setAttribute('aria-label', text('Movimiento') + ' ' + (slot + 1));
        select.append(new Option(text('Vac\u00edo'), ''));
        for (const id of allowed) {
          const option = new Option(moveName(id), id);
          option.disabled = value.loadout.includes(id) && value.loadout[slot] !== id;
          select.append(option);
        }
        select.value = value.loadout[slot] || '';
        select.onchange = () => {
          const ids = value.loadout.slice();
          ids[slot] = select.value;
          try {
            setLoadout(save, dex, ids.filter(Boolean));
          } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            game.UI.toast(text('Elige al menos un ataque. No repitas movimientos.'), 3500);
            render();
            return;
          }
          saveChanges();
          game.Audio.sfx('select');
          render();
        };
        label.append(select);
        slots.append(label);
      }

      const list = $('training-moves');
      list.replaceChildren();
      const entries = species(dex).moves.map(([id, level]) => ({ id, level }));
      for (const id of learnedTms(save, dex)) {
        const existing = entries.find(entry => entry.id === id);
        if (existing) existing.tm = true;
        else entries.push({ id, tm: true });
      }
      for (const id of record(save, dex).inherited) {
        const existing = entries.find(entry => entry.id === id);
        if (!existing) entries.push({ id, inherited: true });
        else if (existing.level > value.level && !existing.tm) existing.inherited = true;
      }
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'sub';
        empty.textContent = text('Esta especie no tiene movimientos de nivel implementados.');
        list.append(empty);
      }
      for (const entry of entries) {
        const def = game.Moves.BY_ID[entry.id], unlocked = allowed.includes(entry.id);
        const row = document.createElement('div');
        row.className = 'training-move panel' + (unlocked ? '' : ' locked');
        const learned = entry.inherited ? text('Antes de evolucionar') : entry.tm ? 'MT' :
          entry.level === 0 ? text('Evoluci\u00f3n') :
          text('Nivel') + ' ' + entry.level;
        row.innerHTML = game.Icons.html('move:' + entry.id, 26) +
          '<div><b>' + escape(moveName(entry.id)) + '</b><small>' + escape(text(def.desc)) +
          '</small></div><div class="training-unlock"><b>' + escape(learned) + '</b><small>' +
          text(unlocked ? 'Disponible' : 'Bloqueado') + '</small></div>';
        list.append(row);
      }
    }

    function open(dex = game.DB.save.partner, play = false, tab = 'moves') {
      if (game.Game.state !== 'ui') {
        game.UI.toast(text('Cambia tus movimientos entre partidas.'), 3000);
        return;
      }
      record(game.DB.save, dex);
      selectedDex = +dex;
      startFromTraining = play;
      activeTab = tab;
      returnToLobby = game.UI.isOpen('scr-lobby') && !!game.Social.room;
      game.UI.show('scr-training', true);
      render();
      $('training-back').focus();
    }

    function decorateDex(dex) {
      if (!game.DB.save.owned[dex]) return;
      const moves = $('dex-moves');
      const summary = document.createElement('div');
      summary.className = 'training-summary';
      summary.innerHTML = progressHtml(dex);
      const button = document.createElement('button');
      button.className = 'btn small';
      button.textContent = text('Entrenamiento');
      button.onclick = () => open(dex);
      summary.append(button);
      moves.before(summary);
    }

    function decorateUpgrades(dex) {
      open(dex, false, 'perks');
    }

    function preparePlayer(player) {
      dismissEvolution();
      const value = state(game.DB.save, player.dex);
      player.moves = [];
      player.slots = [];
      player.bind = {};
      player.active = 0;
      player.pokemonLevel = value.level;
      for (const id of value.loadout) player.addMove(id);
      player.slots = [player.moves.slice()];
      activeRun = {
        player, save: game.DB.save, result: null,
        learning: learningMultiplier(game.DB.save, player.dex)
      };
    }

    function install(context) {
      if (game) throw new Error('Pokemon training is already installed');
      game = context;
      for (const mon of game.DEX) species(mon.dex);
      for (const id of Object.keys(data.moves)) {
        if (!game.Moves.BY_ID[id]) throw new Error('Unsupported combat move: ' + id);
      }
      game.Training = api;
      baseMonFor = game.Mons.monFor.bind(game.Mons);
      game.Mons.monFor = statsFor;
      const originalTaken = game.Stats.taken;
      game.Stats.taken = function (mon, category) {
        const origin = mon && category && statOrigins.get(mon);
        // Keep species defense caps, but let permanent growth benefit every player.
        return origin ? originalTaken.call(this, origin.baseline, category) /
          Math.pow(origin.factor, 0.35) : originalTaken.call(this, mon, category);
      };
      addTranslations();
      const tackle = game.Moves.BY_ID.tackle;
      game.Moves.BY_ID.struggle = {
        ...tackle, id: 'struggle', name: 'Forcejeo',
        desc: 'Ataque de emergencia hasta desbloquear un ataque compatible.'
      };
      for (const [id, info] of Object.entries(data.moves)) {
        game.Moves.BY_ID[id].name = info.names.es;
      }
      for (const lang of ['en', 'fr', 'it', 'pt-BR', 'zh-Hans', 'zh-Hant']) {
        const dictionary = {};
        for (const info of Object.values(data.moves)) {
          dictionary[info.names.es] = info.names[lang] || info.names.en;
        }
        dictionary.Forcejeo = 'Struggle';
        game.I18n.add(dictionary, lang, 'move');
      }
      game.TM_OF = dex => species(dex).tms.slice();
      game.Mons.taught = dex => learnedTms(game.DB.save || {}, dex);
      game.Moves.poolFor = (mon, naturalOnly = false) => {
        const save = game.DB.save;
        const level = save?.owned[mon.dex] ? state(save, mon.dex).level : START_LEVEL;
        const natural = species(mon.dex).moves.filter(([, at]) => at <= level).map(([id]) => id);
        const inherited = !naturalOnly && save?.owned[mon.dex] ? record(save, mon.dex).inherited : [];
        return [...new Set(natural.concat(!naturalOnly && save ? learnedTms(save, mon.dex) : [], inherited))];
      };
      game.startMoveOf = dex => state(game.DB.save, dex).loadout[0];
      game.startMove2Of = () => null;
      const oldPerks = game.Upgrades.perks;
      game.Upgrades.perks = (upgrades = {}) => ({
        ...oldPerks({ ...upgrades, hp: 0, atk: 0, def: 0 }),
        startMoves: 1, bans: 0
      });
      const obsolete = new Set(['hp', 'atk', 'def', 'moves', 'start', 'start2', 'ban']);
      game.Upgrades.LIST.splice(0, game.Upgrades.LIST.length,
        ...game.Upgrades.LIST.filter(upgrade => !obsolete.has(upgrade.id)));
      const learning = game.Upgrades.LIST.find(upgrade => upgrade.id === 'xp');
      if (learning) {
        learning.name = 'Aprendizaje';
        learning.unit = '+5% XP de partida y permanente';
      }
      game.LevelUp.offer = (player, count = 3) =>
        temporaryOffers(game.LevelUp.STATS, player, game.U.pickN, count);

      const originalEvent = game.Progress.event;
      game.Progress.event = function (event, details) {
        if (event === 'runEnd' && activeRun && !activeRun.result) {
          if (activeRun.save !== game.DB.save || activeRun.player !== game.Game.player) {
            throw new Error('Pokemon XP cannot be awarded to a different account or match');
          }
          const player = activeRun.player;
          activeRun.result = award(game.DB.save, player.dex, {
            time: details.time, kills: player.kills, bosses: player.bosses
          }, activeRun.learning);
        }
        return originalEvent.call(this, event, details);
      };
      const originalShowOver = game.RunUI.showOver;
      game.RunUI.showOver = function (...args) {
        originalShowOver.apply(this, args);
        const result = activeRun?.result;
        if (!result) return;
        const run = activeRun, next = $('btn-again'), leave = next.onclick;
        let currentDex = result.dex, evolutionDone = false;
        function validResult() {
          if (activeRun === run && game.DB.save === run.save && run.save.owned[currentDex] &&
              game.Game.state === 'over') return true;
          game.UI.toast(text('El progreso ha cambiado. Vuelve al men\u00fa.'), 4500);
          game.MenuUI.open();
          return false;
        }
        function showProgress() {
          if (!validResult()) return;
          const canEvolve = !evolutionDone && !!result.evolution &&
            !!pendingEvolution(run.save, currentDex);
          $('progress-name').textContent = game.DEX_BY[currentDex].name;
          $('progress-reward').textContent = '+' + number(result.gained) + ' XP';
          $('progress-level').textContent = text('Nivel permanente') + ' ' + result.before.level +
            (result.after.level !== result.before.level ? ' \u2192 ' + result.after.level : '');
          $('progress-summary').innerHTML = progressHtml(currentDex);
          const unlocked = $('progress-unlocks');
          unlocked.classList.toggle('hidden', !result.unlocked.length);
          unlocked.innerHTML = '<h3>' + text('Nuevos movimientos') + '</h3>' +
            result.unlocked.map(id => '<span class="pill">' + escape(moveName(id)) + '</span>').join('');
          $('progress-next').textContent = text(canEvolve ? 'Continuar a evoluci\u00f3n' : 'Volver al men\u00fa');
          $('progress-next').onclick = () => {
            if (!validResult()) return;
            if (canEvolve) {
              openEvolution(currentDex, dex => {
                currentDex = dex;
                evolutionDone = true;
                showProgress();
              });
            } else {
              leave.call(next);
            }
          };
          game.UI.show('scr-progress');
          game.UI.sprite($('progress-stage'), currentDex, {
            scale: 3, hero: true, shadow: false,
            shiny: !!run.save.partnerShiny && !!run.save.shiny?.[currentDex]
          });
          $('progress-title').focus();
        }
        next.textContent = text('Continuar a XP permanente');
        next.onclick = showProgress;
        $('progress-back').onclick = () => {
          if (!validResult()) return;
          game.UI.show('scr-over');
          next.focus();
        };
        $('over-title').focus();
      };

      const originalShow = game.UI.show;
      game.UI.show = function (id, ...args) {
        if (id === 'scr-upgrades') return open(game.DB.save.partner, false, 'perks');
        if (id !== 'scr-evolution') dismissEvolution();
        if (id !== 'scr-progress') $('scr-progress').classList.add('hidden');
        originalShow.call(this, id, ...args);
        if (id === 'scr-menu') renderMenu();
      };
      const originalHideAll = game.UI.hideAll;
      game.UI.hideAll = function (...args) {
        $('scr-progress').classList.add('hidden');
        return originalHideAll.apply(this, args);
      };
      const originalInit = game.MenuUI.init;
      const originalPlay = game.Flow.play;
      game.Flow.play = () => open(game.DB.save.partner, true);
      game.MenuUI.init = function () {
        originalInit.call(this);
        $('menu-training').insertAdjacentHTML('afterbegin',
          '<span class="mi-ico">' + game.Icons.html('book', 26) + '</span>');
        $('menu-training').onclick = () => open();
        for (const [index, tab] of ['moves', 'perks'].entries()) {
          const button = $('training-tab-' + tab);
          button.onclick = () => showTab(tab);
          button.onkeydown = event => {
            let target;
            if (['ArrowLeft', 'ArrowRight'].includes(event.key)) target = 1 - index;
            else if (event.key === 'Home') target = 0;
            else if (event.key === 'End') target = 1;
            else return;
            event.preventDefault();
            showTab(['moves', 'perks'][target], true);
          };
        }
        $('training-back').onclick = () => {
          if (returnToLobby && game.Social.room) game.LobbyUI.open();
          else game.MenuUI.open();
        };
        $('training-play').onclick = () => {
          if (saveChanges()) originalPlay.call(game.Flow);
        };
        const lobby = document.querySelector('#scr-lobby .box');
        const button = document.createElement('button');
        button.className = 'btn small';
        button.textContent = text('Elegir movimientos');
        button.onclick = () => open();
        lobby.append(button);
      };
      game.DB.onSync(() => {
        const evolutionDex = evolving?.finished ? evolving.currentDex : evolving?.dex;
        if (evolving && (game.DB.save !== evolving.save || !game.DB.save?.owned[evolutionDex])) {
          interruptEvolution();
        }
        renderMenu();
        if (game.DB.save && game.UI.isOpen('scr-training')) {
          if (!game.DB.save.owned[selectedDex]) selectedDex = game.DB.save.partner;
          render();
        }
      });
      return api;
    }

    function addTranslations() {
      game.I18n.add({
        'Entrenamiento': 'Training',
        'Estad\u00edsticas, movimientos y ventajas': 'Stats, moves and perks',
        'Tu Pok\u00e9mon crece con cada nivel permanente. Prepara sus movimientos y compra ventajas.':
          'Your Pokemon grows with each permanent level. Prepare its moves and buy perks.',
        'Estad\u00edsticas del juego': 'Game stats',
        'Del nivel 1 al 100: +50% de HP, ataques y defensas; +15% de velocidad. La naturaleza modifica un +10% y un -10% sus estad\u00edsticas indicadas.':
          'From level 1 to 100: +50% HP, attacks and defenses; +15% Speed. Nature raises one indicated stat by 10% and lowers another by 10%.',
        'Ataque': 'Attack',
        'Ataque especial': 'Special Attack',
        'Defensa': 'Defense',
        'Defensa especial': 'Special Defense',
        'Velocidad': 'Speed',
        'F\u00edsico / Especial': 'Physical / Special',
        'No hace da\u00f1o: acumula ATAQUE (f\u00edsico) y ATAQUE ESPECIAL mientras est\u00e9 activo.':
          'Deals no damage: builds (physical) ATTACK and SPECIAL ATTACK while active.',
        'No hace da\u00f1o: acumula ATAQUE (f\u00edsico) y DEFENSA mientras est\u00e9 activo.':
          'Deals no damage: builds (physical) ATTACK and DEFENSE while active.',
        'No hace da\u00f1o: acumula ATAQUE ESPECIAL y DEFENSA mientras est\u00e9 activo.':
          'Deals no damage: builds SPECIAL ATTACK and DEFENSE while active.',
        'No hace da\u00f1o: acumula ATAQUE (f\u00edsico) y VELOCIDAD mientras est\u00e9 activo.':
          'Deals no damage: builds (physical) ATTACK and SPEED while active.',
        'Naturaleza': 'Nature',
        'Habilidad': 'Ability',
        'Sin habilidad': 'No ability',
        'Cambiar naturaleza o habilidad': 'Change nature or ability',
        'Usa tus objetos de la mochila. Consigue Mentas y C\u00e1psulas en la Tienda Kecleon.':
          'Use items from your bag. Get Mints and Capsules at the Kecleon Shop.',
        'Usar Menta': 'Use Mint',
        'Usar C\u00e1psula': 'Use Capsule',
        'Usar C\u00e1psula oculta': 'Use Hidden Capsule',
        'Habilidad oculta': 'Hidden ability',
        'Movimientos': 'Moves',
        'Ventajas': 'Perks',
        'Ventajas permanentes': 'Permanent perks',
        'Las ventajas son de cada Pok\u00e9mon. Aprendizaje aumenta tanto la XP de partida como la permanente. Zancada a\u00f1ade +3% de velocidad por rango (hasta +24%), adem\u00e1s del crecimiento por nivel.':
          'Perks belong to each Pokemon. Learning speed increases both run XP and permanent XP. Stride adds +3% movement speed per rank (up to +24%), on top of level growth.',
        'Aprendizaje': 'Learning speed',
        '+5% XP de partida y permanente': '+5% run XP and permanent XP',
        'No se pudo aplicar. Revisa tus monedas, objetos y l\u00edmites.':
          'Could not apply. Check your coins, items and limits.',
        'Niveles y cuatro movimientos': 'Levels and four moves',
        'Elegir movimientos': 'Choose moves',
        'Nivel permanente': 'Permanent level',
        'Experiencia permanente': 'Permanent XP',
        'Resultados de la partida': 'Run results',
        'Progreso del Pok\u00e9mon': 'Pok\u00e9mon progress',
        'Continuar a XP permanente': 'Continue to permanent XP',
        'Continuar a evoluci\u00f3n': 'Continue to evolution',
        'Volver a resultados': 'Back to results',
        'Volver al men\u00fa': 'Back to menu',
        'XP ganada': 'XP earned',
        'El progreso ha cambiado. Vuelve al men\u00fa.': 'Progress has changed. Return to the menu.',
        'Nivel m\u00e1ximo': 'Maximum level',
        'Datos de movimientos': 'Move data',
        'Movimiento': 'Move',
        'Nivel': 'Level',
        'Vac\u00edo': 'Empty',
        'Disponible': 'Unlocked',
        'Bloqueado': 'Locked',
        'Evoluci\u00f3n': 'Evolution',
        'Evoluciona al nivel': 'Evolves at level',
        'Antes de evolucionar': 'Before evolving',
        'Su m\u00e9todo especial de evoluci\u00f3n a\u00fan no est\u00e1 disponible.':
          'Its special evolution method is not available yet.',
        'est\u00e1 evolucionando...': 'is evolving...',
        'ha dejado de evolucionar.': 'stopped evolving.',
        'Volver\u00e1 a intentarlo al siguiente nivel.': 'It will try again at the next level.',
        'Detener evoluci\u00f3n': 'Stop evolution',
        'Continuar': 'Continue',
        'Animaci\u00f3n suave (sin destellos)': 'Gentle animation (no flashing)',
        'El progreso ha cambiado. Revisa la evoluci\u00f3n de nuevo.':
          'Progress has changed. Check evolution again.',
        'El gacha solo incluye formas base. Evoluciona tus Pok\u00e9mon para conseguir sus siguientes formas.':
          'Gacha only includes base forms. Evolve your Pokemon to obtain their next forms.',
        'Nuevos movimientos': 'New moves',
        'Nivel de la partida': 'Run level',
        'Partida': 'Run',
        'Progreso permanente: estad\u00edsticas, movimientos y evoluciones.':
          'Permanent progress: stats, moves and evolutions.',
        'Este nivel y sus mejoras se reinician en cada partida.':
          'This level and its upgrades reset each run.',
        'Preparar partida': 'Prepare for a match',
        'Empezar partida': 'Start match',
        'Ganas XP permanente al terminar, seg\u00fan el tiempo sobrevivido y los Pok\u00e9mon derrotados, con un extra por jefes. Los primeros 10 niveles son m\u00e1s r\u00e1pidos.':
          'Earn permanent XP when the run ends, based on survival time and defeated Pokemon, plus a boss bonus. The first 10 levels are quicker.',
        'Elige hasta cuatro movimientos. Todos atacan juntos desde el inicio, cada uno a su ritmo.':
          'Choose up to four moves. All attack together from the start, each on its own cooldown.',
        'Todos tus movimientos atacan autom\u00e1ticamente desde el inicio.':
          'All your moves attack automatically from the start.',
        'Arrastra el dedo para moverte \u00b7 todos los ataques son autom\u00e1ticos \u00b7 toca una esfera para usarla':
          'Drag to move \u00b7 all attacks are automatic \u00b7 tap an orb to use it',
        'Se muestran los movimientos implementados, con los niveles y especies de los juegos oficiales. Las MT aprendidas tambi\u00e9n se pueden equipar.':
          'Only implemented moves are shown, with official species eligibility and learn levels. Learned TMs can also be equipped.',
        'Modo invitado: los niveles y movimientos se pierden al salir. Crea una cuenta para guardarlos.':
          'Guest mode: levels and moves are lost when you leave. Create an account to save them.',
        'Forcejeo es un ataque de emergencia: esta especie a\u00fan no tiene un ataque compatible desbloqueado.':
          'Struggle is an emergency attack: this species has no compatible attack unlocked yet.',
        'Esta especie no tiene movimientos de nivel implementados.':
          'This species has no implemented level-up moves.',
        'Ataque de emergencia hasta desbloquear un ataque compatible.':
          'Emergency attack until a compatible attack is unlocked.',
        'Elige al menos un ataque. No repitas movimientos.':
          'Choose at least one attack. Do not repeat moves.',
        'Cambia tus movimientos entre partidas.': 'Change your moves between matches.',
        'No se pudo guardar. No cierres el juego.': 'Could not save. Do not close the game.'
      });
    }

    const api = {
      START_LEVEL, MAX_LEVEL, MAX_MOVES, xpAt, levelAt, normalize, state, available, statsFor,
      setLoadout, reward, award, learningMultiplier, buyPerk, useNature, useAbility,
      merge, pendingEvolution, cancelEvolution, evolve,
      isBase, baseOf, gachaEligible, gachaCollection, gachaPool, gachaRates,
      temporaryOffers, install, open, openEvolution,
      preparePlayer, decorateDex, decorateUpgrades
    };
    return api;
  }

  if (typeof module === 'object' && module.exports) module.exports = { create };
  else window.PSTraining = create(window.PS_LEARNSETS);
})();
