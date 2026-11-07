(function () {
  'use strict';

  const REGIONS = Object.freeze([
    [1, [1, 4, 7, 25]], [2, [152, 155, 158]], [3, [252, 255, 258]],
    [4, [387, 390, 393]], [5, [495, 498, 501]], [6, [650, 653, 656]],
    [7, [722, 725, 728]], [8, [810, 813, 816]], [9, [906, 909, 912]]
  ].map(([gen, starters]) => Object.freeze({ gen, starters: Object.freeze(starters) })));

  function install(game, host = window) {
    const doc = host.document, $ = id => doc.getElementById(id);
    const screen = $('scr-starters'), tabs = $('starter-gens'), panel = $('starter-panel');
    const grid = $('starter-grid'), info = $('starter-info'), confirm = $('starter-ok');
    if (!screen || !tabs || !panel || !grid || !info || !confirm) {
      throw new Error('Missing starter selection screen');
    }
    game.I18n.add({
      'Elige una regi\u00f3n y un Pok\u00e9mon para empezar tu aventura.':
        'Choose a region and a Pokemon to begin your adventure.',
      'Regi\u00f3n de origen': 'Home region',
      'Selecciona un Pok\u00e9mon.': 'Select a Pokemon.',
      'Elegir compa\u00f1ero': 'Choose partner',
      'Tab / flechas: navegar \u00b7 Intro / Espacio: seleccionar \u00b7 Mando: cruceta / palanca y A':
        'Tab / arrows: navigate \u00b7 Enter / Space: select \u00b7 Controller: D-pad / stick and A',
      'La selecci\u00f3n ha cambiado. Elige de nuevo.': 'Selection has changed. Choose again.'
    });
    const text = value => game.T(value);
    let region = REGIONS[0], selected = null, account = null, finished = false, granted = false;
    let tabButtons = [], cards = [];
    const active = () => !screen.classList.contains('hidden');
    const focus = button => {
      button.focus();
      button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const invalid = () => game.UI.toast(text('La selecci\u00f3n ha cambiado. Elige de nuevo.'));

    function clearSelection() {
      selected = null;
      confirm.disabled = true;
      confirm.textContent = text('Elegir compa\u00f1ero');
      info.textContent = text('Selecciona un Pok\u00e9mon.');
    }

    function select(dex, button) {
      if (!active() || finished || granted) return;
      if (account !== game.DB.save || account.partner || !region.starters.includes(dex) ||
          !cards.includes(button)) {
        invalid();
        return;
      }
      selected = dex;
      for (const card of cards) {
        const on = card === button;
        card.classList.toggle('on', on);
        card.setAttribute('aria-pressed', String(on));
      }
      info.textContent = game.DEX_BY[dex].name;
      confirm.disabled = false;
    }

    function renderRegion(next) {
      if (granted) return;
      region = next;
      clearSelection();
      for (let i = 0; i < tabButtons.length; i++) {
        const on = REGIONS[i] === region;
        tabButtons[i].classList.toggle('on', on);
        tabButtons[i].setAttribute('aria-selected', String(on));
        tabButtons[i].tabIndex = on ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', 'starter-gen-' + region.gen);
      $('starter-region').textContent = text(game.Gacha.BANNERS.find(banner => banner.gen === region.gen).name);
      cards = region.starters.map(dex => {
        const mon = game.DEX_BY[dex], button = doc.createElement('button');
        button.type = 'button';
        button.className = 'cell starter-card';
        button.dataset.dex = dex;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', mon.name);
        const name = doc.createElement('b'), types = doc.createElement('span');
        name.textContent = mon.name;
        name.setAttribute('translate', 'no');
        types.className = 'starter-types';
        types.innerHTML = game.UI.typeChips(mon.types);
        button.append(game.UI.spriteCanvas(dex, 112, 88, { scale: 2 }), name, types);
        button.onclick = () => select(dex, button);
        return button;
      });
      grid.replaceChildren(...cards);
    }

    function complete() {
      if (!active() || finished) return;
      if (account !== game.DB.save || (account.partner && (!granted || account.partner !== selected)) ||
          !region.starters.includes(selected)) {
        clearSelection();
        invalid();
        return;
      }
      confirm.disabled = true;
      if (!granted) {
        account.starter = selected;
        account.partner = selected;
        game.DB.grant(selected, 'starter');
        account.onboarding = { version: 1, dex: selected, stage: 'practice' };
        granted = true;
        for (const button of [...tabButtons, ...cards]) button.disabled = true;
      }
      const saved = game.DB.commit();
      if (!game.DB.guest && !saved) {
        game.UI.toast(text('No se pudo guardar. No cierres el juego.'), 4500);
        confirm.disabled = false;
        focus(confirm);
        return;
      }
      finished = true;
      game.Tutorial.start();
    }

    function init() {
      for (const [id, label] of [
        ['starter-title', 'Elige a tu compa\u00f1ero'],
        ['starter-subtitle', 'Elige una regi\u00f3n y un Pok\u00e9mon para empezar tu aventura.'],
        ['starter-help', 'Tab / flechas: navegar \u00b7 Intro / Espacio: seleccionar \u00b7 Mando: cruceta / palanca y A']
      ]) $(id).textContent = text(label);
      tabs.setAttribute('aria-label', text('Regi\u00f3n de origen'));
      tabButtons = REGIONS.map(entry => {
        if (!game.Gacha.BANNERS.some(banner => banner.gen === entry.gen) ||
            entry.starters.some(dex => !game.DEX_BY[dex])) {
          throw new Error('Missing starter region data: ' + entry.gen);
        }
        const banner = game.Gacha.BANNERS.find(item => item.gen === entry.gen);
        const button = doc.createElement('button'), name = doc.createElement('b');
        const generation = doc.createElement('small');
        button.type = 'button';
        button.id = 'starter-gen-' + entry.gen;
        button.className = 'gen-tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'starter-panel');
        name.textContent = text(banner.name);
        generation.textContent = 'Gen ' + entry.gen;
        button.append(name, generation);
        button.onclick = () => renderRegion(entry);
        return button;
      });
      tabs.replaceChildren(...tabButtons);
      confirm.onclick = complete;
    }

    function start() {
      if (game.DB.save.partner) {
        if (!game.Tutorial.resume()) game.Flow.goMenu();
        return;
      }
      account = game.DB.save;
      finished = false;
      granted = false;
      for (const button of tabButtons) button.disabled = false;
      game.UI.chrome(false);
      renderRegion(REGIONS[0]);
      game.UI.show('scr-starters');
      focus(tabButtons[0]);
    }

    host.addEventListener('keydown', event => {
      if (!active() || event.ctrlKey || event.altKey || event.metaKey) return;
      const code = event.code;
      if (['Tab', 'Enter', 'Space'].includes(code)) {
        // Keep native button activation and tab order, not the game's virtual shortcuts.
        event.stopImmediatePropagation();
        return;
      }
      if (code === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (granted) return;
      const tabIndex = tabButtons.indexOf(event.target), cardIndex = cards.indexOf(event.target);
      let destination;
      if (tabIndex >= 0) {
        let next = tabIndex;
        if (code === 'ArrowRight') next = (tabIndex + 1) % tabButtons.length;
        else if (code === 'ArrowLeft') next = (tabIndex + tabButtons.length - 1) % tabButtons.length;
        else if (code === 'Home') next = 0;
        else if (code === 'End') next = tabButtons.length - 1;
        else if (code === 'ArrowDown') destination = cards[0];
        else return;
        if (!destination) {
          renderRegion(REGIONS[next]);
          destination = tabButtons[next];
        }
      } else if (cardIndex >= 0) {
        if (code === 'ArrowRight') destination = cards[(cardIndex + 1) % cards.length];
        else if (code === 'ArrowLeft') destination = cards[(cardIndex + cards.length - 1) % cards.length];
        else if (code === 'Home') destination = cards[0];
        else if (code === 'End') destination = cards[cards.length - 1];
        else if (code === 'ArrowUp') destination = tabButtons[region.gen - 1];
        else if (code === 'ArrowDown' && !confirm.disabled) destination = confirm;
        else return;
      } else if (event.target === confirm && code === 'ArrowUp') {
        destination = cards.find(card => +card.dataset.dex === selected);
      } else return;
      if (destination) {
        event.preventDefault();
        event.stopImmediatePropagation();
        focus(destination);
      }
    }, true);

    game.TestUI.init = init;
    game.TestUI.start = start;
    const afterLogin = game.Flow.afterLogin;
    game.Flow.afterLogin = function (...args) {
      if (!game.Tutorial.resume()) return afterLogin.apply(this, args);
    };
  }

  const api = { REGIONS, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    window.PSOnboarding = api;
    const installTraining = window.PSTraining.install;
    window.PSTraining.install = function (context) {
      const result = installTraining.call(this, context);
      window.PSTutorial.install(context);
      install(context);
      return result;
    };
  }
})();
