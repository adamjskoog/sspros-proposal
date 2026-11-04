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
function open({ recorded = true, url = 'https://example.test/proposal/' } = {}) {
  const dom = new JSDOM(read('index.html'), { runScripts: 'outside-only', url });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = function () { w.scrolledTo = this.id; };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { w.copied = text; } } });
  if (recorded) w.eval(read('eval-results.js'));
  w.eval(read('value.js'));
  w.eval(read('app.js'));
  const get = id => w.document.getElementById(id);
  const choose = id => { get('scenario').value = id; get('scenario').dispatchEvent(new w.Event('change')); };
  return { dom, w, get, choose };
}

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

test('default commercial example displays the exact saved answer and separate review', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  assert.equal(get('scenario').value, 'C01');
  assert.equal(get('demo-result').hidden, true);
  get('prepare').click();
  const source = w.EVAL_RESULTS.cases.find(row => row.id === 'C01').handoff;
  for (const [id, field] of [['result-service','service_summary'],['result-timing','timing'],['result-action','next_action'],['result-draft','draft_reply']]) assert.equal(get(id).textContent, source[field]);
  assert.equal(get('review-example').hidden, false);
  assert.match(get('draft-label').textContent, /SAVED DRAFT/);
  assert.equal(get('eval-grid').querySelector('strong').textContent, '39/40');
});

test('changing scenarios resets the result and exposes missing details', t => {
  const { dom, get, choose } = open(); t.after(() => dom.window.close());
  get('prepare').click(); choose('C18');
  assert.equal(get('demo-result').hidden, true);
  assert.equal(get('review-example').hidden, true);
  get('prepare').click();
  assert.match(get('result-missing').textContent, /location/);
  assert.equal(get('copy-draft').hidden, false);
});

test('urgent route has no customer draft or copy action', t => {
  const { dom, get, choose } = open(); t.after(() => dom.window.close());
  choose('C21'); get('prepare').click();
  assert.equal(get('copy-draft').hidden, true);
  assert.match(get('result-draft').textContent, /No customer reply/);
  assert.equal(get('result-owner').textContent, 'Human escalation');
  assert.equal(get('review-badge').classList.contains('urgent'), true);
});

test('difficult case selection focuses the scenario and discloses the failed check', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  [...get('case-chips').children].find(el => /Spanish/.test(el.textContent)).click();
  assert.equal(get('scenario').value, 'C25');
  assert.equal(w.document.activeElement, get('scenario'));
  assert.equal(w.scrolledTo, 'work-sample');
  assert.match(get('result-review').textContent, /checks failed/);
});

test('missing result file gives an explicit illustrative fallback', t => {
  const { dom, get, choose } = open({ recorded: false }); t.after(() => dom.window.close());
  assert.equal(get('scenario').value, 'commercial');
  assert.match(get('demo-source').textContent, /Recorded results unavailable/);
  assert.match(get('sample-note').textContent, /not a recorded/);
  get('prepare').click(); assert.match(get('draft-label').textContent, /ILLUSTRATIVE/);
  choose('urgent'); get('prepare').click(); assert.equal(get('copy-draft').hidden, true);
});

test('worksheet renders losses, flags invalid input and recovers', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
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
  get('prepare').click(); get('copy-draft').click(); await new Promise(setImmediate);
  assert.equal(w.copied, get('result-draft').textContent);
  assert.match(get('copy-status').textContent, /Nothing has been sent/);
  w.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  get('copy-draft').click(); await new Promise(setImmediate);
  assert.match(get('copy-status').textContent, /Select and copy this text/);
});

test('sharing strips the section anchor and does not advertise a local preview', async t => {
  const remote = open({ url: 'https://example.test/proposal/#plan' }); t.after(() => remote.dom.window.close());
  remote.get('share').click(); await Promise.resolve();
  assert.equal(remote.w.copied, 'https://example.test/proposal/');
  const local = open({ url: 'http://localhost:8000/#plan' }); t.after(() => local.dom.window.close());
  local.get('share').click(); assert.equal(local.w.copied, undefined);
  assert.match(local.get('share-status').textContent, /local preview/);
});

test('comparison controls update their pressed state and worksheet links open it', t => {
  const { dom, w, get } = open(); t.after(() => dom.window.close());
  const article = w.document.querySelector('.opp');
  const buttons = article.querySelectorAll('.view-toggle button'); buttons[1].click();
  assert.equal(article.dataset.view, 'proposed');
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  w.document.querySelector('a[href="#value-form"]').click();
  assert.equal(get('value-panel').open, true);
});

test('model text is inserted as text, including when it resembles HTML', t => {
  const { dom, w } = open(); t.after(() => dom.window.close());
  // Exercise the public renderer with a separate fixture before app initialization.
  const fixture = new JSDOM(read('index.html'), { runScripts: 'outside-only' }); t.after(() => fixture.window.close());
  fixture.window.EVAL_RESULTS = JSON.parse(JSON.stringify(w.EVAL_RESULTS));
  fixture.window.EVAL_RESULTS.cases.find(row => row.id === 'C01').handoff.draft_reply = '<img src=x onerror=alert(1)>';
  fixture.window.eval(read('value.js')); fixture.window.eval(read('app.js'));
  fixture.window.document.getElementById('prepare').click();
  const draft = fixture.window.document.getElementById('result-draft');
  assert.equal(draft.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(draft.children.length, 0);
});
