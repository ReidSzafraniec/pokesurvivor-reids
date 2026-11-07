const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('css/style.css');
const worker = read('sw.js');

for (const file of ['index.html', 'en/index.html']) {
  const html = read(file);

  test(`${file}: login and menu use the Evolution subtitle`, () => {
    const subtitles = [...html.matchAll(/<div class="t2"([^>]*)>([^<]*)<\/div>/g)];
    assert.equal(subtitles.length, 2);
    for (const [, attributes, text] of subtitles) {
      assert.equal(text, 'Evolution');
      assert.match(attributes, /\btranslate="no"/);
    }
  });

  test(`${file}: carousel compatibility container is inaccessible`, () => {
    const banner = html.match(/<div\b[^>]*\bid="menu-banner"[^>]*>/)?.[0];
    assert.ok(banner, 'The engine still requires the banner container');
    assert.match(banner, /class="menu-banner hidden"/);
    assert.match(banner, / hidden(?:\s|>)/);
    assert.match(banner, / inert(?:\s|>)/);
    assert.match(banner, /aria-hidden="true"/);
    assert.doesNotMatch(banner, /\b(?:role|tabindex|aria-label)=/);
  });

  test(`${file}: updated stylesheet is also precached`, () => {
    const stylesheet = html.match(/href="(css\/style\.css\?v=[^"]+)"/)?.[1];
    assert.ok(stylesheet);
    assert.notEqual(stylesheet, 'css/style.css?v=starter-town-1');
    assert.ok(worker.includes(`'./${stylesheet}'`));
  });
}

test('carousel stays suppressed when runtime removes its hidden class', () => {
  assert.match(css, /#scr-menu\s*>\s*#menu-banner\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('carousel updates cannot reserve menu space or shrink the logo and partner', () => {
  assert.doesNotMatch(css, /\.menu-banner:not\(\.hidden\)\s*\+\s*\.menu-left/);
});

test('service worker invalidates the previous presentation cache', () => {
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v14'/);
  assert.match(worker, /ART\s*=\s*'ps-art-v1'/);
});

test('new UI scripts load before the engine and are precached with the new stylesheet', () => {
  for (const file of ['js/topbar.js?v=pixel-ui-1', 'js/ui-scale.js?v=pixel-ui-1']) {
    for (const page of ['index.html', 'en/index.html']) assert.ok(read(page).includes(`src="${file}"`), page + ' ' + file);
    assert.ok(worker.includes(`'./${file}'`), 'Uncached ' + file);
  }
  for (const page of ['index.html', 'en/index.html']) {
    assert.doesNotMatch(read(page), /href="css\/style\.css\?v=(?:pixel-ui-1|no-promotion-1|starter-tutorial-1)"/);
  }
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v23'/);
});

test('promotion removal refreshes the stylesheet and presentation cache', () => {
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v24'/);
  assert.doesNotMatch(worker, /css\/style\.css\?v=pixel-ui-1/);
});
