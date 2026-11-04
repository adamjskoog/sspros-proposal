'use strict';
/* Example message dashboard. Everything is made up and stays in this browser; nothing is sent.
   All user and model text is inserted with textContent. */
(function () {
  const D = window.DashboardData;
  const sorter = window.TriageSorter;
  if (!D || !document.getElementById('dash')) return;
  const $ = id => document.getElementById(id);
  const STORE_KEY = 'sspros-dashboard-v1';
  const MINUTE = 60000;
  const STATUS_ORDER = ['new', 'waiting_us', 'waiting_customer', 'done'];
  const FIELD_LABELS = { location: 'location', timing: 'timing', property_type: 'home or business', scope_details: 'what work is needed' };
  const ROUTE_LANE = { human_escalation: 'urgent', estimator: 'electrical', office_intake: 'comms', out_of_scope: 'comms', spam: 'comms' };
  const DEFAULT_NEXT = {
    urgent: 'URGENT: the on-call lead calls back right away. No reply by text or email.',
    electrical: 'Estimator reviews the request and decides the next step.',
    comms: 'Office sends the reply below once it’s approved, then follows up.',
    web: 'Adam looks into it and shows the owner any change before it goes live.'
  };
  const now = Date.now();

  /* ---------- Base items ---------- */
  function savedItems() {
    const cases = Array.isArray(window.EVAL_RESULTS?.cases) ? window.EVAL_RESULTS.cases : [];
    const byId = new Map(cases.filter(c => c?.handoff && Array.isArray(c.handoff.missing_fields)).map(c => [c.id, c]));
    return D.SAVED.filter(s => byId.has(s.id)).map(s => {
      const c = byId.get(s.id); const h = c.handoff;
      return {
        id: s.id, kind: 'saved', source: 'website', from: s.from, title: s.title, receivedAt: now - s.minutesAgo * MINUTE,
        lane: ROUTE_LANE[h.route] || 'comms', status: s.status || 'new', message: c.inquiry, service: h.service_summary,
        location: h.location || 'Not provided', timing: h.timing || 'Not provided',
        missing: h.missing_fields.map(f => FIELD_LABELS[f] || f), next: h.next_action, draft: h.draft_reply,
        notes: [h.reviewer_notes, c.passed ? 'Passed the automatic checks in testing. A person still reviews it.' : 'Some automatic checks failed on this answer in testing. A person would need to correct it.'].filter(Boolean).join('\n\n')
      };
    });
  }
  const baseItems = [...savedItems(), ...D.WRITTEN.map(w => ({ ...w, kind: 'written', receivedAt: now - w.minutesAgo * MINUTE }))];
  const savedLoaded = baseItems.some(i => i.kind === 'saved');

  /* ---------- State (persisted per browser; safe if storage is unavailable) ---------- */
  function emptyStore() { return { overrides: {}, added: [], team: {} }; }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (parsed && typeof parsed === 'object' && parsed.overrides && Array.isArray(parsed.added) && parsed.team) return parsed;
    } catch { /* storage blocked or corrupt: start fresh */ }
    return emptyStore();
  }
  let store = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* per-visit only */ } }
  const view = { q: '', sources: new Set(Object.keys(D.SOURCES)), showDone: false, selected: null, lastCard: null };

  const allBase = () => [...baseItems, ...store.added];
  function seedLog(base) {
    const sortedBy = base.kind === 'saved' ? 'the AI (saved test answer)' : base.kind === 'sorted' ? 'the safety check in this browser' : 'hand (written example)';
    const entries = [{ at: base.receivedAt, text: 'Received · ' + base.from }, { at: base.receivedAt + 1000, text: 'Sorted into ' + D.LANES[base.lane].name + ' by ' + sortedBy }];
    if (base.status && base.status !== 'new') entries.push({ at: base.receivedAt + 2000, text: 'Marked ' + D.STATUSES[base.status] });
    return entries;
  }
  function item(id) {
    const base = allBase().find(i => i.id === id);
    if (!base) return null;
    const o = store.overrides[id] || {};
    const lane = o.lane || base.lane;
    return { ...base, ...o, lane, assignee: o.assignee || D.LANES[lane].person, log: [...seedLog(base), ...(o.log || [])], teamNotes: o.teamNotes || [] };
  }
  const items = () => allBase().map(b => item(b.id));
  function update(id, changes, logText) {
    const o = { ...(store.overrides[id] || {}), ...changes };
    if (logText) o.log = [...(o.log || []), { at: Date.now(), text: logText }];
    store = { ...store, overrides: { ...store.overrides, [id]: o } };
    save(); render();
  }
  const personName = id => store.team[id] || (D.TEAM.find(t => t.id === id) || { name: id }).name;

  /* ---------- Formatting ---------- */
  function ago(at) {
    const mins = Math.max(0, Math.round((Date.now() - at) / MINUTE));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h < 24 ? h + ' h' + (m ? ' ' + m + ' min' : '') + ' ago' : new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* ---------- Board ---------- */
  function matches(i) {
    if (!view.sources.has(i.source)) return false;
    if (!view.showDone && i.status === 'done') return false;
    if (!view.q) return true;
    return [i.title, i.message, i.from, personName(i.assignee)].join(' ').toLowerCase().includes(view.q);
  }
  function card(i) {
    const b = el('button', 'dcard' + (i.lane === 'urgent' ? ' is-urgent' : '') + (i.status === 'done' ? ' is-done' : ''));
    b.type = 'button'; b.dataset.id = i.id;
    b.setAttribute('aria-pressed', String(view.selected === i.id));
    const top = el('span', 'dcard-top');
    top.append(el('span', 'src src-' + i.source, D.SOURCES[i.source]), el('span', 'dcard-time', ago(i.receivedAt)));
    const meta = el('span', 'dcard-meta');
    const who = el('span', 'who'); who.append(el('span', 'avatar', initials(personName(i.assignee))), el('span', '', personName(i.assignee)));
    meta.append(who, el('span', 'pill pill-' + i.status, D.STATUSES[i.status]));
    b.append(top, el('strong', 'dcard-title', i.title), meta);
    if (i.missing.length && i.status !== 'done') b.append(el('span', 'needs', 'Needs: ' + i.missing.join(', ')));
    b.addEventListener('click', () => openPanel(i.id, true));
    return b;
  }
  function sortForLane(a, b) {
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.receivedAt - b.receivedAt;
  }
  function renderBoard() {
    const all = items(); const shown = all.filter(matches);
    for (const lane of Object.keys(D.LANES)) {
      const list = $('lane-' + lane);
      const inLane = shown.filter(i => i.lane === lane).sort(sortForLane);
      list.replaceChildren(...inLane.map(i => { const li = el('li'); li.append(card(i)); return li; }));
      $('count-' + lane).textContent = String(inLane.filter(i => i.status !== 'done').length);
      $('empty-' + lane).hidden = inLane.length > 0;
      $('lane-person-' + lane).textContent = personName(D.LANES[lane].person);
    }
    $('result-count').textContent = 'Showing ' + shown.length + ' of ' + all.length;
    renderStats(all);
  }
  function renderStats(all) {
    const open = all.filter(i => i.status !== 'done');
    const urgent = open.filter(i => i.lane === 'urgent');
    const onUs = open.filter(i => i.lane !== 'urgent' && (i.status === 'new' || i.status === 'waiting_us'));
    $('stat-urgent').textContent = String(urgent.length);
    $('stat-urgent-sub').textContent = urgent.length ? 'Oldest: ' + ago(Math.min(...urgent.map(i => i.receivedAt))) : 'All clear';
    $('stat-us').textContent = String(onUs.length);
    $('stat-us-sub').textContent = onUs.length ? 'Longest wait: ' + ago(Math.min(...onUs.map(i => i.receivedAt))).replace(' ago', '') : 'Nothing waiting';
    $('stat-customer').textContent = String(open.filter(i => i.status === 'waiting_customer').length);
    $('stat-done').textContent = String(all.filter(i => i.status === 'done').length);
  }

  /* ---------- Detail panel ---------- */
  function fillSelect(select, entries, value) {
    select.replaceChildren(...entries.map(([v, label]) => new Option(label, v)));
    select.value = value;
  }
  function renderPanel() {
    const i = view.selected && item(view.selected);
    $('panel').hidden = !i;
    document.body.classList.toggle('panel-open', Boolean(i));
    if (!i) return;
    const urgent = i.lane === 'urgent';
    const hasDraft = !urgent && Boolean(i.draft);
    $('panel').classList.toggle('is-urgent', urgent);
    $('panel-title').textContent = i.title;
    $('panel-from').textContent = i.from + ' · ' + ago(i.receivedAt);
    $('panel-kind').textContent = { saved: 'Saved AI answer', written: 'Written example', sorted: 'Sorted in your browser' }[i.kind];
    $('panel-kind').className = 'kind kind-' + i.kind;
    $('panel-message').textContent = '“' + i.message + '”';
    $('panel-service').textContent = i.service;
    $('panel-location').textContent = i.location;
    $('panel-timing').textContent = i.timing;
    $('panel-missing').textContent = i.missing.length ? i.missing.join(', ') : 'Nothing';
    $('panel-next').textContent = i.next;
    $('panel-notes').textContent = i.notes;
    fillSelect($('f-assignee'), D.TEAM.map(t => [t.id, personName(t.id) + ' · ' + t.role]), i.assignee);
    fillSelect($('f-lane'), Object.entries(D.LANES).map(([k, l]) => [k, l.name]), i.lane);
    fillSelect($('f-status'), Object.entries(D.STATUSES), i.status);
    $('draft-block').hidden = !hasDraft;
    $('no-draft').hidden = hasDraft;
    $('no-draft').textContent = urgent ? 'No automatic reply. A person calls this customer directly.' : 'No customer reply needed for this one.';
    if (document.activeElement !== $('f-draft')) $('f-draft').value = hasDraft ? i.draft : '';
    $('btn-approve').hidden = !hasDraft;
    $('btn-called').hidden = !urgent;
    $('btn-escalate').hidden = urgent;
    const finished = i.status === 'done' || i.status === 'waiting_customer';
    $('btn-approve').disabled = finished;
    $('btn-called').disabled = i.status === 'done';
    $('panel-log').replaceChildren(...[...i.log].reverse().map(e => { const li = el('li'); li.append(el('span', 'log-time', ago(e.at)), el('span', '', e.text)); return li; }));
    $('panel-note-list').replaceChildren(...i.teamNotes.map(n => { const li = el('li'); li.append(el('span', 'log-time', ago(n.at)), el('span', '', n.text)); return li; }));
    $('panel-note-list').hidden = !i.teamNotes.length;
  }
  function openPanel(id, fromCard) {
    view.selected = id;
    if (fromCard) view.lastCard = id;
    render();
    $('panel-title').focus({ preventScroll: true });
    $('panel').scrollTop = 0;
  }
  function closePanel() {
    const back = view.lastCard;
    view.selected = null; render();
    const cardEl = back && document.querySelector('.dcard[data-id="' + back + '"]');
    if (cardEl) cardEl.focus();
  }

  /* ---------- Dialogs and messages ---------- */
  function openDialog(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
  function closeDialog(d) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  function toast(text) {
    $('toast').textContent = text;
    $('toast').hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { $('toast').hidden = true; }, 6000);
  }
  function addMessage(source, from, message) {
    const result = sorter.sortMessage(message);
    const id = 'N' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const base = {
      id, kind: 'sorted', source, from: D.SOURCES[source] + ' · ' + from, title: result.title, receivedAt: Date.now(),
      lane: result.lane, status: 'new', message, service: 'The real AI would summarize this message.',
      location: result.missing.includes('location') ? 'Not given' : 'Mentioned in the message',
      timing: result.missing.includes('timing') ? 'Not given' : 'Mentioned in the message',
      missing: result.missing, next: DEFAULT_NEXT[result.lane], draft: result.draft,
      notes: result.reasons.join(' ') + ' These simple rules lean cautious; the real version adds the tested AI, and a person checks everything.'
    };
    store = { ...store, added: [...store.added, base] };
    save();
    return { id, result };
  }
  function validateNew() {
    const from = $('n-from').value.trim(); const message = $('n-message').value.trim();
    const problems = [];
    if (!from) problems.push('Add who it’s from.');
    if (message.length < 10) problems.push('Type a message of at least 10 characters.');
    $('n-error').textContent = problems.join(' ');
    $('n-error').hidden = !problems.length;
    $('n-from').setAttribute('aria-invalid', String(!from));
    $('n-message').setAttribute('aria-invalid', String(message.length < 10));
    return problems.length ? null : { from, message };
  }
  function syncSourceButtons() {
    document.querySelectorAll('[data-source]').forEach(b => b.setAttribute('aria-pressed', String(view.sources.has(b.dataset.source))));
  }

  /* ---------- Wiring ---------- */
  function render() { renderBoard(); renderPanel(); }

  $('search').addEventListener('input', e => { view.q = e.target.value.trim().toLowerCase(); renderBoard(); });
  document.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', () => {
    const s = btn.dataset.source;
    const next = new Set(view.sources);
    if (next.has(s) && next.size > 1) next.delete(s); else next.add(s);
    view.sources = next; syncSourceButtons(); renderBoard();
  }));
  $('show-done').addEventListener('change', e => { view.showDone = e.target.checked; renderBoard(); });
  $('panel-close').addEventListener('click', closePanel);

  $('f-assignee').addEventListener('change', e => update(view.selected, { assignee: e.target.value }, 'Assigned to ' + personName(e.target.value)));
  $('f-lane').addEventListener('change', e => {
    const lane = e.target.value;
    update(view.selected, { lane, assignee: D.LANES[lane].person, ...(lane === 'urgent' ? { status: 'new' } : {}) }, 'Moved to ' + D.LANES[lane].name);
  });
  $('f-status').addEventListener('change', e => update(view.selected, { status: e.target.value }, 'Marked ' + D.STATUSES[e.target.value]));
  $('item-form').addEventListener('submit', e => e.preventDefault());
  $('btn-approve').addEventListener('click', () => {
    const i = item(view.selected); const draft = $('f-draft').value.trim();
    if (!draft) { toast('The reply is empty. Write something before approving.'); return; }
    const edited = draft !== (allBase().find(b => b.id === i.id).draft || '');
    update(i.id, { draft, status: 'waiting_customer' }, 'Reply approved by ' + personName(i.assignee) + (edited ? ' (edited)' : '') + '. Example only; nothing was sent.');
    toast('Approved. In the real version it would go out from your normal email or text.');
  });
  $('btn-called').addEventListener('click', () => {
    const i = item(view.selected);
    update(i.id, { status: 'done' }, 'Called back by ' + personName(i.assignee));
    toast('Marked as called back.');
  });
  $('btn-escalate').addEventListener('click', () => {
    update(view.selected, { lane: 'urgent', assignee: 'oncall', status: 'new' }, 'Sent to a person now');
    toast('Moved to “Needs a person now.”');
  });
  $('note-form').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('f-note').value.trim();
    if (!text) return;
    const i = item(view.selected);
    update(i.id, { teamNotes: [...i.teamNotes, { at: Date.now(), text }] }, 'Note added');
    $('f-note').value = '';
  });

  $('open-new').addEventListener('click', () => { $('new-form').reset(); $('n-error').hidden = true; openDialog($('new-dialog')); $('n-from').focus(); });
  document.querySelectorAll('[data-example]').forEach(btn => btn.addEventListener('click', () => {
    const [source, from, message] = btn.dataset.example.split('|');
    $('n-source').value = source; $('n-from').value = from; $('n-message').value = message;
    $('n-message').focus();
  }));
  $('new-form').addEventListener('submit', e => {
    e.preventDefault();
    const valid = validateNew();
    if (!valid) return;
    const source = $('n-source').value;
    const { id, result } = addMessage(source, valid.from, valid.message);
    closeDialog($('new-dialog'));
    view.sources = new Set([...view.sources, source]); syncSourceButtons();
    openPanel(id, true);
    toast('Sorted into ' + D.LANES[result.lane].name + '. ' + result.reasons[0]);
  });
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeDialog(btn.closest('dialog'))));

  $('open-team').addEventListener('click', () => {
    $('team-fields').replaceChildren(...D.TEAM.map(t => {
      const label = el('label'); label.append(el('span', '', t.role));
      const input = el('input'); input.name = t.id; input.value = personName(t.id); input.maxLength = 40; input.required = true; input.autocomplete = 'off';
      label.append(input); return label;
    }));
    openDialog($('team-dialog'));
  });
  $('team-form').addEventListener('submit', e => {
    e.preventDefault();
    const team = {};
    for (const t of D.TEAM) { const v = e.target.elements[t.id].value.trim(); if (v) team[t.id] = v; }
    store = { ...store, team }; save(); closeDialog($('team-dialog')); render(); toast('Team names updated.');
  });
  $('open-how').addEventListener('click', () => openDialog($('how-dialog')));
  $('reset').addEventListener('click', () => {
    store = emptyStore(); save(); view.selected = null; render(); toast('The example has been reset.');
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape' && view.selected && !document.querySelector('dialog[open]')) closePanel();
    else if (e.key === '/' && !typing) { e.preventDefault(); $('search').focus(); }
    else if ((e.key === 'n' || e.key === 'N') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]')) { e.preventDefault(); $('open-new').click(); }
  });

  $('saved-note').hidden = savedLoaded;
  const requested = new URLSearchParams(location.search).get('case');
  if (requested && item(requested)) view.selected = requested;
  render();
  setInterval(renderBoard, MINUTE);
  window.Dashboard = { items: () => items().map(i => i.id), item };
})();
