// Integer UI scale (--s) for the canvas HUD: large screens draw it at 2× / 3× like the HTML UI.
(function () {
  function create(root) {
    let cached = 0, active = 1;
    const read = () => {
      const value = parseInt(root.getComputedStyle(root.document.documentElement).getPropertyValue('--s'), 10);
      return Number.isInteger(value) && value > 1 ? value : 1;
    };
    root.addEventListener('resize', () => { cached = 0; });
    return {
      scale: () => cached || (cached = read()),
      buttonScale: () => active,
      drawHud(hud, ctx, width, height, player, extra) {
        const s = this.scale();
        if (s === 1) return hud.draw(ctx, width, height, player, extra);
        ctx.save();
        ctx.scale(s, s);
        active = s;
        try { return hud.draw(ctx, width / s, height / s, player, extra); }
        finally { active = 1; ctx.restore(); }
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else window.PSUiScale = create(window);
})();
