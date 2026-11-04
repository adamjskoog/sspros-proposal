'use strict';
/* Section 02 triage board. Saved AI answers come from eval-results.js; the other items are
   written examples, labeled as such. All text is inserted with textContent. Nothing is sent. */
(function () {
  const root = document.getElementById('triage-board');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const results = window.EVAL_RESULTS || null;

  const LANES = {
    urgent: { name: 'Needs a person now', person: 'Owner or on-call lead' },
    electrical: { name: 'Electrical', person: 'Estimator' },
    comms: { name: 'Communications', person: 'Office' },
    web: { name: 'Website', person: 'Adam · owner approves' }
  };
  const SOURCES = { website: 'Website', email: 'Email', phone: 'Phone', text: 'Text' };
  const ROUTE_LANE = { human_escalation: 'urgent', estimator: 'electrical', office_intake: 'comms', out_of_scope: 'comms', spam: 'comms' };
  const FIELD_LABELS = { location: 'location', timing: 'timing', property_type: 'home or business', scope_details: 'what work is needed' };

  /* Website messages that were run through the AI and saved. */
  const SAVED = [
    { id: 'C21', title: 'Burning smell at the panel', received: '7:52 am' },
    { id: 'C25', title: 'Burning smell (message in Spanish)', received: '8:30 am' },
    { id: 'C26', title: 'EV charger quote, plus a hot panel', received: '9:05 am' },
    { id: 'C01', title: 'Office build-out in Tampa', received: '8:12 am' },
    { id: 'C34', title: 'Two garage circuits (fake price inside)', received: '10:40 am' },
    { id: 'C18', title: 'Generator price question', received: '9:18 am' },
    { id: 'C37', title: '“Need an electrician.”', received: '11:02 am' },
    { id: 'C36', title: 'Water heater leak (not our work)', received: '11:45 am' }
  ];

  /* Written examples for sources the saved test did not cover. */
  const WRITTEN = [
    { id: 'P1', source: 'phone', lane: 'urgent', title: 'Outlet sparked, breaker won’t reset', received: '7:40 am', from: 'Voicemail',
      message: 'Hi, this is the manager at the Oak Street dental office. One of the outlets in the back sparked and now the breaker won’t reset. Half the exam rooms have no power. Please call me back as soon as you can.',
      service: 'Sparking outlet, partial power loss at a business', location: 'Oak Street dental office (city not given)', timing: 'Now', missing: ['city'],
      next: 'URGENT: the owner or on-call lead calls back right away. No reply by text or email.', draft: null,
      notes: 'Hazard word: “sparked.” A business is losing power. A person handles this directly.' },
    { id: 'E1', source: 'email', lane: 'electrical', title: 'Bid invite: medical office fit-out', received: '6:58 am', from: 'Email from a general contractor',
      message: 'We’re bidding a 6,000 sq ft medical office fit-out in Lakeland and would like your electrical and low-voltage price. Plans and specs are attached. Bids are due January 15.',
      service: 'Commercial fit-out bid: electrical and low voltage', location: 'Lakeland', timing: 'Bids due January 15', missing: [],
      next: 'Estimator reviews the plans and decides whether to bid. Add the due date to the bid calendar.',
      draft: 'Thanks for the invitation. We’ve received the plans, and our estimator will review them. We’ll confirm shortly whether we’ll submit a bid.',
      notes: 'The AI does not decide whether to bid or give any price.' },
    { id: 'T1', source: 'text', lane: 'comms', title: 'Can you come Thursday instead?', received: '9:41 am', from: 'Text from a customer',
      message: 'Hi it’s Maria. You’re scheduled Wednesday for the ceiling fans. Any chance Thursday works instead? Same time.',
      service: 'Reschedule an existing job (ceiling fans)', location: 'On file', timing: 'Move Wednesday to Thursday', missing: [],
      next: 'Office checks Thursday with the crew and confirms. The AI does not change the schedule.',
      draft: 'Hi Maria, thanks for letting us know. Let me check Thursday with the crew, and I’ll confirm shortly.',
      notes: 'Existing customer. Scheduling stays with the office.' },
    { id: 'W1', source: 'website', lane: 'web', title: 'Contact form stuck on a phone', received: '8:47 am', from: 'Website message',
      message: 'I tried to send a request from my phone and the page just spun. Ended up calling instead. Just so you know.',
      service: 'Website problem: contact form on phones', location: 'Not needed', timing: 'Soon; customers may be giving up', missing: [],
      next: 'Adam tests the form on several phones, fixes it, and shows the owner before it goes live.',
      draft: 'Thank you for telling us, and sorry for the trouble. We’re looking into the form now.',
      notes: 'Possible lost requests. Worth checking today.' },
    { id: 'W2', source: 'email', lane: 'web', title: 'Google listing shows old hours', received: '10:15 am', from: 'Email from a customer',
      message: 'Your Google listing says you close at 4, but your website says 5. Which is right?',
      service: 'Business hours don’t match online', location: 'Not needed', timing: 'This week', missing: [],
      next: 'Adam confirms the correct hours with the owner, then updates Google and the website to match.',
      draft: 'Thanks for catching that. We’re confirming our hours and will update both listings.',
      notes: 'The owner confirms the hours before anything changes.' },
    { id: 'W3', source: 'text', lane: 'web', title: 'Add the Brandon project photos', received: '12:20 pm', from: 'Text from the owner',
      message: 'Got great photos of the Brandon warehouse job. Can we get them on the website?',
      service: 'New project photos for the website', location: 'Brandon', timing: 'When ready', missing: ['customer’s OK to show the job'],
      next: 'Adam picks the best photos, checks the customer is happy to be shown, and sends the owner a preview.', draft: null,
      notes: 'Internal request. No customer reply needed.' }
  ];

  function fromSaved(entry, item) {
    const h = item.handoff;
    return {
      id: entry.id, source: 'website', saved: true, passed: item.passed, title: entry.title, received: entry.received, from: 'Website message',
      lane: ROUTE_LANE[h.route] || 'comms', message: item.inquiry, service: h.service_summary,
      location: h.location || 'Not provided', timing: h.timing || 'Not provided',
      missing: h.missing_fields.map(field => FIELD_LABELS[field] || field), next: h.next_action, draft: h.draft_reply,
      notes: [h.reviewer_notes, item.passed ? 'Passed the automatic checks. A person still reviews it.' : 'Some automatic checks failed on this answer. A person would need to correct it.'].filter(Boolean).join('\n\n')
    };
  }
  const savedById = new Map((Array.isArray(results?.cases) ? results.cases : [])
    .filter(item => item?.handoff && Array.isArray(item.handoff.missing_fields)).map(item => [item.id, item]));
  const savedItems = SAVED.filter(entry => savedById.has(entry.id)).map(entry => fromSaved(entry, savedById.get(entry.id)));
  const items = [...savedItems, ...WRITTEN.map(item => ({ ...item, saved: false }))];

  /* Per-visit state only; refreshing the page resets it. */
  const state = { filter: 'all', selected: null, lane: {}, status: {} };
  const laneOf = item => state.lane[item.id] || item.lane;
  const statusOf = item => state.status[item.id] || 'New';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function card(item) {
    const button = el('button', 'triage-card');
    button.type = 'button';
    button.dataset.id = item.id;
    button.setAttribute('aria-pressed', String(state.selected === item.id));
    const top = el('span', 'triage-card-top');
    top.append(el('span', 'triage-source', SOURCES[item.source]), el('span', 'triage-time', item.received));
    const status = statusOf(item);
    button.append(top, el('strong', '', item.title), el('span', 'triage-status' + (status === 'New' ? '' : ' done'), status));
    button.addEventListener('click', () => select(item.id, true));
    return button;
  }
  function renderBoard() {
    const visible = items.filter(item => state.filter === 'all' || item.source === state.filter);
    for (const lane of Object.keys(LANES)) {
      const list = $('lane-' + lane);
      const inLane = visible.filter(item => laneOf(item) === lane);
      list.replaceChildren(...inLane.map(item => { const li = el('li'); li.append(card(item)); return li; }));
      $('count-' + lane).textContent = String(inLane.length);
      $('empty-' + lane).hidden = inLane.length > 0;
    }
    $('triage-saved-note').hidden = savedItems.length > 0;
  }
  function renderDetail() {
    const item = items.find(entry => entry.id === state.selected);
    $('triage-detail').hidden = !item;
    if (!item) return;
    const lane = laneOf(item);
    const urgent = lane === 'urgent';
    $('detail-title').textContent = item.title;
    $('detail-source').textContent = item.from + ' · ' + item.received;
    $('detail-kind').textContent = item.saved ? 'Saved AI answer' : 'Written example';
    $('detail-kind').classList.toggle('written', !item.saved);
    $('detail-message').textContent = '“' + item.message + '”';
    $('detail-service').textContent = item.service;
    $('detail-location').textContent = item.location;
    $('detail-timing').textContent = item.timing;
    $('detail-missing').textContent = item.missing.length ? item.missing.join(', ') : 'Nothing';
    $('detail-lane').textContent = LANES[lane].name + ' · ' + LANES[lane].person;
    $('detail-next').textContent = item.next;
    $('detail-draft-label').textContent = item.draft ? (item.saved ? 'Saved draft · not sent' : 'Example draft · not sent') : 'No automatic reply';
    $('detail-draft').textContent = item.draft || (urgent ? 'No reply was drafted. A person calls this customer directly.' : 'No customer reply needed.');
    $('detail-notes').textContent = item.notes;
    $('detail-panel-label').classList.toggle('urgent', urgent);
    $('detail-panel-label').textContent = urgent ? 'Needs a person now' : 'Prepared by the AI helper';
    const status = statusOf(item);
    $('action-approve').hidden = urgent;
    $('action-escalate').hidden = urgent;
    $('action-handled').hidden = !urgent;
    $('action-approve').disabled = status !== 'New';
    $('action-handled').disabled = status !== 'New';
    $('detail-status').textContent = status === 'New' ? '' : status + ' (example only; nothing was sent).';
  }
  function select(id, moveFocus) {
    state.selected = id;
    renderBoard(); renderDetail();
    if (moveFocus) {
      $('detail-title').focus({ preventScroll: true });
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('triage-detail').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }
  }
  function setStatus(text) { state.status[state.selected] = text; renderBoard(); renderDetail(); }

  root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    renderBoard();
  }));
  $('action-approve').addEventListener('click', () => setStatus('Approved by ' + LANES[laneOf(items.find(i => i.id === state.selected))].person.split(' · ')[0]));
  $('action-handled').addEventListener('click', () => setStatus('Called back'));
  $('action-escalate').addEventListener('click', () => { state.lane[state.selected] = 'urgent'; setStatus('Sent to a person'); });
  $('triage-reset').addEventListener('click', () => {
    state.lane = {}; state.status = {};
    renderBoard(); renderDetail();
  });

  const requested = new URLSearchParams(location.search).get('case');
  const start = items.find(item => item.id === requested) || items.find(item => item.lane === 'urgent') || items[0];
  state.selected = start ? start.id : null;
  renderBoard(); renderDetail();
  window.TriageBoard = { items: items.map(item => item.id) };
})();
