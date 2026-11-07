window.PS_PAGES = !!document.querySelector('meta[name="ps-pages"]');
(function () {
  // El idioma lo elige locales.js (en el <head>).
  var copy = {
    es: ['Juego de supervivencia con Pokémon, gratis en el navegador y en el móvil.', 'Cargando…'],
    en: ['A Pokémon survival game, free in your browser and on mobile.', 'Loading…'],
    fr: ['Un jeu de survie Pokémon gratuit sur navigateur et mobile.', 'Chargement…'],
    it: ['Un gioco di sopravvivenza Pokémon gratuito su browser e cellulare.', 'Caricamento…'],
    'pt-BR': ['Um jogo de sobrevivência Pokémon grátis no navegador e no celular.', 'Carregando…'],
    'zh-Hans': ['免费的宝可梦生存游戏，可在浏览器和手机上游玩。', '加载中…'],
    'zh-Hant': ['免費的寶可夢生存遊戲，可在瀏覽器與手機上遊玩。', '載入中…']
  }[window.PS_LOCALES && window.PS_LOCALES.lang];
  if (!copy) return;
  var p = document.querySelectorAll('#boot p');
  p[0].textContent = copy[0]; p[1].textContent = copy[1];
})();

addEventListener('error', function (event) {
  var boot = document.getElementById('boot');
  var source = event.target && event.target.src || event.filename || '';
  if (!boot || boot.classList.contains('hidden') ||
      !/(?:learnsets|training|tutorial|town(?:-multiplayer)?|onboarding|app\.min)\.js(?:\?|$)/.test(source)) return;
  var spanish = window.PS_LOCALES && window.PS_LOCALES.lang === 'es';
  var message = document.createElement('p'), retry = document.createElement('button');
  message.textContent = spanish
    ? 'No se pudo cargar el juego. Comprueba tu conexión y recarga.'
    : 'Could not load the game. Check your connection and reload.';
  retry.className = 'btn gold';
  retry.textContent = spanish ? 'Recargar' : 'Reload';
  retry.onclick = function () { location.reload(); };
  boot.replaceChildren(message, retry);
}, true);
