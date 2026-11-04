const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { estimate } = require('../value.js');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const base = { requests: 20, manual: 10, assisted: 6, maintenance: 1, setup: 8, rate: 30, tools: 400 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function open({ page = 'index.html', url = 'https://example.test/proposal/' } = {}) {
  const dom = new JSDOM(read(page), { runScripts: 'outside-only', url });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { w.copied = text; } } });
  w.eval(read('eval-results.js'));
  w.eval(read('value.js'));
  w.eval(read('app.js'));
  return { dom, w, get: id => w.document.getElementById(id) };
}
const details = () => open({ page: 'details.html', url: 'https://example.test/proposal/details.html' });

test('worksheet includes review, monthly maintenance, first-month setup and tool spending', () => {
  const result = estimate(base);
  close(result.hours, 43 / 9);
  close(result.firstMonth, -29 / 9);
  close(result.capacity, 430 / 3);
  close(result.netValue, -770 / 3);
});

test('zero volume retains overhead and assisted work can take longer', () => {
  assert.deepEqual(estimate({ ...base, requests: 0 }), { hours: -1, firstMonth: -9, capacity: -30, netValue: -430 });
  assert.ok(estimate({ ...base, assisted: 12 }).hours < -1);
});

test('worksheet rejects blank, absent, non-finite and out-of-range values', () => {
  for (const value of [undefined, null, '', '20', NaN, Infinity, -1, 1001]) {
    assert.equal(estimate({ ...base, requests: value }), null);
  }
  assert.equal(estimate({ ...base, tools: 401 }), null);
  assert.equal(estimate({ ...base, rate: 501 }), null);
  assert.ok(estimate({ ...base, tools: 0, setup: 0 }));
});

test('section two explains the idea briefly and links to the dashboard page', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  const section = get('work-sample');
  const links = [...section.querySelectorAll('a')].map(a => a.getAttribute('href'));
  assert.ok(links.includes('dashboard.html'));
  assert.equal(section.querySelectorAll('button, select, textarea, input').length, 0, 'no interactive board on the main page');
  assert.equal(section.querySelectorAll('.teaser-points li').length, 3);
  assert.ok(w.document.querySelector('nav a[href="#work-sample"]'));
});

test('details page shows test results and links harder examples to the dashboard', t => {
  const { dom, get } = details(); t.after(() => dom.window.close());
  assert.equal(get('eval-grid').querySelector('strong').textContent, '39/40');
  const chips = [...get('case-chips').children];
  assert.ok(chips.length >= 3);
  assert.equal(chips.find(el => /Spanish/.test(el.textContent)).getAttribute('href'), 'dashboard.html?case=C25');
  const saved = require('../dashboard-data.js').SAVED.map(s => s.id);
  for (const chip of chips) assert.ok(saved.includes(new URL(chip.getAttribute('href'), 'https://x.test/').searchParams.get('case')));
});

test('worksheet renders losses, flags invalid input and recovers', t => {
  const { dom, w, get } = details(); t.after(() => dom.window.close());
  assert.match(get('net-value').textContent, /-/);
  const input = get('requests'); input.value = '';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(get('value-error').hidden, false);
  assert.match(get('value-error').textContent, /0 to 1000/);
  assert.equal(get('hours').textContent, '—');
  input.value = '0'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(input.getAttribute('aria-invalid'), 'false');
  assert.equal(get('hours').textContent, '-1.0');
  assert.equal(get('value-error').hidden, true);
});

test('sharing strips the anchor and query and does not advertise a local preview', async t => {
  const remote = open({ url: 'https://example.test/proposal/?x=1#plan' }); t.after(() => remote.dom.window.close());
  remote.get('share').click(); await Promise.resolve();
  assert.equal(remote.w.copied, 'https://example.test/proposal/');
  const local = open({ url: 'http://localhost:8000/#plan' }); t.after(() => local.dom.window.close());
  local.get('share').click(); assert.equal(local.w.copied, undefined);
  assert.match(local.get('share-status').textContent, /local preview/);
});
