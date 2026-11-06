// Top-bar overflow ("⋯") on phones and tablets. Button ids are untouched, so the engine's wiring keeps working.
(function () {
  function install(doc) {
    const bar = doc.getElementById('topbar');
    const toggle = doc.getElementById('topbar-more');
    const menu = doc.getElementById('topbar-menu');
    if (!bar || !toggle || !menu) return null;
    const set = open => {
      toggle.setAttribute('aria-expanded', String(open));
      bar.classList.toggle('more-open', open);
    };
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      set(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', event => {
      if (event.target && event.target.closest && event.target.closest('button, .pill')) set(false);
    });
    doc.addEventListener('click', event => { if (!bar.contains(event.target)) set(false); });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') set(false); });
    return { set };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  else install(document);
})();
