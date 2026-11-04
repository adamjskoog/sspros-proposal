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
function open({ page = 'index.html', recorded = true, url = 'https://example.test/proposal/', results } = {}) {
  const dom = new JSDOM(read(page), { runScripts: 'outside-only', url });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { w.copied = text; } } });
  if (results) w.EVAL_RESULTS = results;
  else if (recorded) w.eval(read('eval-results.js'));
  w.eval(read('value.js'));
  w.eval(read('app.js'));
  const get = id => w.document.getElementById(id);
  const choose = id => { get('scenario').value = id; get('scenario').dispatchEvent(new w.Event('change')); };
  return { dom, w, get, choose };
}
const details = (options = {}) => open({ page: 'details.html', url: 'https://example.test/proposal/details.html', ...options });

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

test('the commercial example shows the exact saved answer without a click', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  assert.equal(get('scenario').value, 'C01');
  assert.equal(get('demo-result').hidden, false);
  const source = w.EVAL_RESULTS.cases.find(row => row.id === 'C01').handoff;
  for (const [id, field] of [['result-service','service_summary'],['result-timing','timing'],['result-action','next_action'],['result-draft','draft_reply']]) assert.equal(get(id).textContent, source[field]);
  assert.equal(get('review-example').hidden, false);
  assert.match(get('draft-label').textContent, /Saved draft/);
});

test('changing examples updates the answer and shows missing details', t => {
  const { dom, get, choose } = open(); t.after(() => dom.window.close());
  choose('C18');
  assert.equal(get('review-example').hidden, true);
  assert.match(get('sample-message').textContent, /generator/i);
  assert.match(get('result-missing').textContent, /location/);
  assert.equal(get('copy-draft').hidden, false);
});

test('urgent route has no customer draft or copy action', t => {
  const { dom, get, choose } = open(); t.after(() => dom.window.close());
  choose('C21');
  assert.equal(get('copy-draft').hidden, true);
  assert.match(get('result-draft').textContent, /No reply was drafted/);
  assert.equal(get('result-owner').textContent, 'A person, right away');
  assert.equal(get('review-badge').classList.contains('urgent'), true);
});

test('a harder example linked from the details page opens on the main page', t => {
  const { dom, get } = open({ url: 'https://example.test/proposal/?case=C25#work-sample' }); t.after(() => dom.window.close());
  assert.equal(get('scenario').value, 'C25');
  assert.match(get('result-review').textContent, /checks failed/);
  const ignored = open({ url: 'https://example.test/proposal/?case=nope' }); t.after(() => ignored.dom.window.close());
  assert.equal(ignored.get('scenario').value, 'C01');
});

test('missing result file gives clearly labeled written examples', t => {
  const { dom, get, choose } = open({ recorded: false }); t.after(() => dom.window.close());
  assert.equal(get('scenario').value, 'commercial');
  assert.match(get('demo-source').textContent, /Saved answers unavailable/);
  assert.match(get('sample-note').textContent, /not a saved AI answer/);
  assert.match(get('draft-label').textContent, /Example draft/);
  choose('urgent'); assert.equal(get('copy-draft').hidden, true);
});

test('details page shows test results and links harder examples to the main page', t => {
  const { dom, get } = details(); t.after(() => dom.window.close());
  assert.equal(get('eval-grid').querySelector('strong').textContent, '39/40');
  const chips = [...get('case-chips').children];
  const spanish = chips.find(el => /Spanish/.test(el.textContent));
  assert.equal(spanish.getAttribute('href'), 'index.html?case=C25#work-sample');
  assert.ok(chips.every(el => !/Commercial build-out|missing details|Urgent electrical/.test(el.textContent)));
  assert.equal(get('hard-cases').hidden, false);
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

test('copy preserves the exact saved draft and clipboard denial is understandable', async t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  get('copy-draft').click(); await new Promise(setImmediate);
  assert.equal(w.copied, get('result-draft').textContent);
  assert.match(get('copy-status').textContent, /Nothing has been sent/);
  w.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  get('copy-draft').click(); await new Promise(setImmediate);
  assert.match(get('copy-status').textContent, /Select and copy this text/);
});

test('sharing strips the anchor and query and does not advertise a local preview', async t => {
  const remote = open({ url: 'https://example.test/proposal/?case=C25#plan' }); t.after(() => remote.dom.window.close());
  remote.get('share').click(); await Promise.resolve();
  assert.equal(remote.w.copied, 'https://example.test/proposal/');
  const local = open({ url: 'http://localhost:8000/#plan' }); t.after(() => local.dom.window.close());
  local.get('share').click(); assert.equal(local.w.copied, undefined);
  assert.match(local.get('share-status').textContent, /local preview/);
});

test('model text is inserted as text, including when it resembles HTML', t => {
  const fixture = JSON.parse(read('eval-results.js').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
  fixture.cases.find(row => row.id === 'C01').handoff.draft_reply = '<img src=x onerror=alert(1)>';
  const { dom, get } = open({ results: fixture }); t.after(() => dom.window.close());
  assert.equal(get('result-draft').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(get('result-draft').children.length, 0);
});
