// Minimal CSS reader for tests: top-level and @media rules (one nesting level).
const MEDIA = {
  COMPACT: '(max-width: 499px), (max-height: 499px)',
  COMPACT_LAND: '(max-height: 499px) and (orientation: landscape)',
  PORTRAIT: '(orientation: portrait)',
  EXPANDED: '(min-width: 1100px) and (min-height: 600px)'
};
const norm = text => text.replace(/\s+/g, ' ').trim();

function rules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const close = open => {
    for (let depth = 0, i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return i;
    }
    throw new Error('Unbalanced CSS near offset ' + open);
  };
  (function walk(from, to, media) {
    for (let at = from; at < to;) {
      const open = css.indexOf('{', at);
      if (open < 0 || open >= to) return;
      const prelude = norm(css.slice(at, open));
      const end = close(open);
      if (prelude.startsWith('@media')) walk(open + 1, end, norm(prelude.slice(6)));
      else if (!prelude.startsWith('@')) out.push({ media, selector: prelude, body: norm(css.slice(open + 1, end)) });
      at = end + 1;
    }
  })(0, css.length, '');
  return out;
}

function find(source, selector, media = '') {
  const matches = rules(source).filter(rule => rule.media === norm(media) &&
    rule.selector.split(',').map(norm).includes(selector));
  return matches.length ? { media: norm(media), selector, body: matches.map(rule => rule.body).join(' ') } : undefined;
}

function tokens(source) {
  const set = new Set();
  for (const { selector } of rules(source)) {
    for (const token of selector.replace(/\[[^\]]*\]/g, '').match(/[.#]-?[A-Za-z_][\w-]*/g) || []) set.add(token);
  }
  return [...set].sort();
}

module.exports = { MEDIA, rules, find, tokens };
