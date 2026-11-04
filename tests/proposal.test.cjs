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
const savedResults = () => JSON.parse(read('eval-results.js').replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
function open({ page = 'index.html', recorded = true, url = 'https://example.test/proposal/', results } = {}) {
  const dom = new JSDOM(read(page), { runScripts: 'outside-only', url });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = function () { w.scrolledTo = this.id; };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { w.copied = text; } } });
  if (results) w.EVAL_RESULTS = results;
  else if (recorded) w.eval(read('eval-results.js'));
  w.eval(read('value.js'));
  w.eval(read('board.js'));
  w.eval(read('app.js'));
  const get = id => w.document.getElementById(id);
  const ids = lane => [...get('lane-' + lane).querySelectorAll('.triage-card')].map(card => card.dataset.id);
  const click = id => w.document.querySelector(`.triage-card[data-id="${id}"]`).click();
  return { dom, w, get, ids, click };
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

test('board sorts saved answers by their recorded route and written examples by lane', t => {
  const { dom, get, ids } = open(); t.after(() => dom.window.close());
  assert.deepEqual(ids('urgent'), ['C21', 'C25', 'C26', 'P1']);
  assert.deepEqual(ids('electrical'), ['C01', 'C34', 'E1']);
  assert.deepEqual(ids('comms'), ['C18', 'C37', 'C36', 'T1']);
  assert.deepEqual(ids('web'), ['W1', 'W2', 'W3']);
  assert.equal(get('count-urgent').textContent, '4');
  assert.equal(get('triage-saved-note').hidden, true);
});

test('the board opens on the first urgent item, with no draft and a call-back action', t => {
  const { dom, get } = open(); t.after(() => dom.window.close());
  assert.equal(get('triage-detail').hidden, false);
  assert.equal(get('detail-title').textContent, 'Burning smell at the panel');
  assert.match(get('detail-draft').textContent, /calls this customer directly/);
  assert.equal(get('action-handled').hidden, false);
  assert.equal(get('action-approve').hidden, true);
  assert.equal(get('detail-panel-label').textContent, 'Needs a person now');
});

test('a saved card shows the exact saved AI answer and is labeled as saved', t => {
  const { dom, w, get, click } = open(); t.after(() => dom.window.close());
  click('C01');
  const source = w.EVAL_RESULTS.cases.find(row => row.id === 'C01').handoff;
  assert.equal(get('detail-service').textContent, source.service_summary);
  assert.equal(get('detail-next').textContent, source.next_action);
  assert.equal(get('detail-draft').textContent, source.draft_reply);
  assert.equal(get('detail-kind').textContent, 'Saved AI answer');
  assert.match(get('detail-draft-label').textContent, /Saved draft/);
  assert.equal(w.document.activeElement, get('detail-title'));
});

test('written examples are labeled as written, not as AI answers', t => {
  const { dom, get, click } = open(); t.after(() => dom.window.close());
  click('E1');
  assert.equal(get('detail-kind').textContent, 'Written example');
  assert.match(get('detail-draft-label').textContent, /Example draft/);
  assert.match(get('detail-lane').textContent, /Estimator/);
});

test('approving, escalating and resetting change only the example board', t => {
  const { dom, get, ids, click } = open(); t.after(() => dom.window.close());
  click('C01'); get('action-approve').click();
  assert.match(get('detail-status').textContent, /Approved by Estimator.*nothing was sent/);
  assert.equal(get('action-approve').disabled, true);
  click('T1'); get('action-escalate').click();
  assert.ok(ids('urgent').includes('T1'));
  assert.ok(!ids('comms').includes('T1'));
  assert.equal(get('action-handled').hidden, false);
  get('triage-reset').click();
  assert.ok(ids('comms').includes('T1'));
  click('C01'); assert.equal(get('action-approve').disabled, false);
});

test('source filters narrow every lane and show empty-lane notes', t => {
  const { dom, w, get, ids } = open(); t.after(() => dom.window.close());
  w.document.querySelector('[data-filter="phone"]').click();
  assert.deepEqual(ids('urgent'), ['P1']);
  assert.deepEqual(ids('electrical'), []);
  assert.equal(get('empty-electrical').hidden, false);
  assert.equal(w.document.querySelector('[data-filter="phone"]').getAttribute('aria-pressed'), 'true');
  assert.equal(w.document.querySelector('[data-filter="all"]').getAttribute('aria-pressed'), 'false');
});

test('a harder example linked from the details page opens on the board', t => {
  const { dom, get } = open({ url: 'https://example.test/proposal/?case=C25#work-sample' }); t.after(() => dom.window.close());
  assert.equal(get('detail-title').textContent, 'Burning smell (message in Spanish)');
  assert.match(get('detail-notes').textContent, /checks failed/);
  const ignored = open({ url: 'https://example.test/proposal/?case=nope' }); t.after(() => ignored.dom.window.close());
  assert.equal(ignored.get('detail-title').textContent, 'Burning smell at the panel');
});

test('without saved answers the board shows only written examples and says so', t => {
  const { dom, get, ids } = open({ recorded: false }); t.after(() => dom.window.close());
  assert.deepEqual(ids('urgent'), ['P1']);
  assert.equal(get('triage-saved-note').hidden, false);
  assert.equal(get('detail-kind').textContent, 'Written example');
});

test('details page shows test results and links harder examples to the board', t => {
  const { dom, get } = details(); t.after(() => dom.window.close());
  assert.equal(get('eval-grid').querySelector('strong').textContent, '39/40');
  const chips = [...get('case-chips').children];
  assert.equal(chips.find(el => /Spanish/.test(el.textContent)).getAttribute('href'), 'index.html?case=C25#work-sample');
  const { dom: board, w } = open(); t.after(() => board.window.close());
  for (const chip of chips) {
    const id = new URL(chip.getAttribute('href'), 'https://x.test/').searchParams.get('case');
    assert.ok(w.TriageBoard.items.includes(id), id + ' should be on the board');
  }
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
  const remote = open({ url: 'https://example.test/proposal/?case=C25#plan' }); t.after(() => remote.dom.window.close());
  remote.get('share').click(); await Promise.resolve();
  assert.equal(remote.w.copied, 'https://example.test/proposal/');
  const local = open({ url: 'http://localhost:8000/#plan' }); t.after(() => local.dom.window.close());
  local.get('share').click(); assert.equal(local.w.copied, undefined);
  assert.match(local.get('share-status').textContent, /local preview/);
});

test('model text is inserted as text, including when it resembles HTML', t => {
  const fixture = savedResults();
  fixture.cases.find(row => row.id === 'C01').handoff.draft_reply = '<img src=x onerror=alert(1)>';
  const { dom, get, click } = open({ results: fixture }); t.after(() => dom.window.close());
  click('C01');
  assert.equal(get('detail-draft').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(get('detail-draft').children.length, 0);
});
