const test = require('node:test');
const assert = require('node:assert/strict');
const { install } = require('../js/topbar.js');

function element() {
  const classes = new Set(), attrs = {}, listeners = {};
  return {
    classes, attrs, listeners,
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) },
    setAttribute: (name, value) => { attrs[name] = String(value); },
    getAttribute: name => (name in attrs ? attrs[name] : null),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    contains: target => Boolean(target && target.inside)
  };
}

test('top bar overflow opens, closes on item click, outside click and Escape', () => {
  const bar = element(), toggle = element(), menu = element(), docListeners = {};
  const doc = {
    getElementById: id => ({ topbar: bar, 'topbar-more': toggle, 'topbar-menu': menu })[id],
    addEventListener: (type, fn) => { docListeners[type] = fn; }
  };
  install(doc);
  const stop = { stopPropagation() {} };
  toggle.listeners.click(stop);
  assert.equal(toggle.attrs['aria-expanded'], 'true');
  assert.ok(bar.classes.has('more-open'));
  menu.listeners.click({ target: { closest: () => ({}) } });
  assert.equal(toggle.attrs['aria-expanded'], 'false');
  toggle.listeners.click(stop);
  docListeners.click({ target: { inside: false } });
  assert.ok(!bar.classes.has('more-open'));
  toggle.listeners.click(stop);
  docListeners.keydown({ key: 'Escape' });
  assert.ok(!bar.classes.has('more-open'));
});

test('top bar overflow is inert when its markup is missing', () => {
  assert.equal(install({ getElementById: () => null, addEventListener() {} }), null);
});
