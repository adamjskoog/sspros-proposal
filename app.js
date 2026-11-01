'use strict';
const $ = id => document.getElementById(id);
const results = window.EVAL_RESULTS || null;

/* Preset examples, used only until a real evaluation run is published. */
const presets = {
  commercial: {
    title: 'Commercial build-out',
    message: '“We’re planning an office build-out in Tampa and need help with power and data cabling. We’re aiming for next quarter. We can share the floor plan. Email is best.”',
    service: 'Commercial electrical + cabling', location: 'Tampa', timing: 'Next quarter', owner: 'Estimator',
    action: 'Confirm coverage, request the floor plan, and assign an estimator.',
    draft: 'Thanks for reaching out about your office build-out. Could you share the floor plan and your target dates? Our team will review the power and cabling scope and follow up with next steps.',
    review: 'A person confirms scope and wording before anything is sent. No price or availability is promised.', badge: 'Team review needed', urgent: false
  },
  missing: {
    title: 'Request with missing details', message: '“I’m interested in getting a generator installed at my house. Can you send me a price?”',
    service: 'Home standby generator', location: 'Not provided', timing: 'Not provided', owner: 'Office intake',
    action: 'Ask for the project city and timing. Pricing questions go to the estimator.',
    draft: 'Thanks for your interest in a generator installation. What city is the home in, and what timing do you have in mind? The team can then review what is needed for an estimate.',
    review: 'Missing details stay visible. The workflow never invents a location, price, or appointment.', badge: 'More details needed', urgent: false
  },
  urgent: {
    title: 'Urgent electrical concern', message: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    service: 'Reported hazard at a panel', location: 'Not provided', timing: 'Today', owner: 'Person, immediately',
    action: 'Escalate through the company’s urgent-contact procedure. Do not place in the estimate queue.',
    draft: null,
    review: 'No automated reply, troubleshooting, or safety advice is produced for hazards.', badge: 'Human escalation', urgent: true
  }
};

const SHOWCASE_TITLES = {
  C25: 'Emergency written in Spanish', C26: 'Emergency buried in a quote request', C34: 'Trick message asking for a fake price',
  C36: 'Trick hidden in an off-topic request', C19: 'Breaker that keeps tripping', C37: 'Too vague: “Need an electrician.”'
};
const ROUTE_LABELS = {
  estimator: 'Estimator', office_intake: 'Office intake', human_escalation: 'Person, immediately',
  out_of_scope: 'Polite decline', spam: 'No reply (spam)'
};

function fromEval(item) {
  const h = item.handoff;
  const badge = h.route === 'human_escalation' ? 'Human escalation'
    : h.route === 'spam' ? 'Spam · no reply'
    : h.route === 'out_of_scope' ? 'Polite decline'
    : h.missing_fields.length ? 'More details needed' : 'Team review needed';
  const verdict = item.passed ? 'Passed every check in the practice test.' : 'The practice test flagged this one for a closer look.';
  return {
    title: SHOWCASE_TITLES[item.id] || item.id, message: '“' + item.inquiry + '”',
    service: h.service_summary, location: h.location || 'Not provided', timing: h.timing || 'Not provided',
    owner: ROUTE_LABELS[h.route] || h.route, action: h.next_action, draft: h.draft_reply,
    review: [h.reviewer_notes, verdict].filter(Boolean).join(' '), badge, urgent: h.route === 'human_escalation'
  };
}

const showcaseOrder = Object.keys(SHOWCASE_TITLES);
const samples = results && results.showcase && results.showcase.length
  ? Object.fromEntries([...results.showcase]
      .sort((a, b) => showcaseOrder.indexOf(a.id) - showcaseOrder.indexOf(b.id))
      .map(item => [item.id, fromEval(item)]))
  : presets;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function setupDemo() {
  if (samples === presets) return;
  const select = $('scenario');
  select.replaceChildren(...Object.entries(samples).map(([id, sample]) => new Option(sample.title, id)));
  $('demo-mode').textContent = 'Real AI results';
  $('demo-source').textContent = 'Saved from the practice test · ' + formatDate(results.meta.run_at);
  $('demo-intro').textContent = 'These are real answers from the AI practice test, not scripted examples. Pick a tricky message and see exactly what the tool prepared.';
  $('sample-note').textContent = 'Shown exactly as the AI wrote it and as it was graded (AI model: ' + results.meta.model + ').';
}

function resetDemo() {
  const sample = samples[$('scenario').value];
  $('sample-title').textContent = sample.title;
  $('sample-message').textContent = sample.message;
  $('demo-empty').hidden = false;
  $('demo-result').hidden = true;
  $('prepare').innerHTML = 'Sort this message <span aria-hidden="true">→</span>';
  $('copy-status').textContent = '';
}

function showHandoff() {
  const sample = samples[$('scenario').value];
  for (const key of ['service', 'location', 'timing', 'owner', 'action', 'review']) $('result-' + key).textContent = sample[key];
  const hasDraft = Boolean(sample.draft);
  $('result-draft').textContent = hasDraft ? sample.draft : 'No customer reply is drafted for this route. A person handles it directly.';
  $('draft-label').textContent = hasDraft ? 'DRAFT REPLY · NOT SENT' : 'NO AUTOMATED REPLY';
  $('copy-draft').hidden = !hasDraft;
  $('review-badge').textContent = sample.badge;
  $('review-badge').classList.toggle('urgent', sample.urgent);
  $('demo-empty').hidden = true;
  $('demo-result').hidden = false;
  $('prepare').innerHTML = 'Sorted <span aria-hidden="true">✓</span>';
  $('copy-status').textContent = '';
}

function metricCard(value, label, note) {
  const card = document.createElement('div');
  card.className = 'eval-metric';
  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;
  card.append(strong, span);
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    card.append(small);
  }
  return card;
}

function ratio(metric) {
  return metric.passed + '/' + metric.total;
}

function percent(metric) {
  return metric.total ? Math.round((metric.passed / metric.total) * 100) + '%' : '—';
}

function renderResults() {
  if (!results) return;
  const s = results.summary;
  $('eval-meta').textContent = s.cases + ' practice inquiries I wrote, each checked against the right answer · run ' +
    formatDate(results.meta.run_at);
  const cards = [
    metricCard(ratio(s.all_checks_passed), 'Messages handled correctly', 'Sorted, details found, reply drafted'),
    metricCard(ratio(s.emergency_recall), 'Emergencies sent to a person', 'Danger always goes to a human'),
    metricCard(String(s.unsafe_drafts), 'Unsafe replies', 'No made-up prices or promises')
  ];
  if (s.cost_usd && s.latency_s) {
    const cents = Math.max(1, Math.round(s.cost_usd.per_inquiry * 100));
    cards.push(metricCard('≈' + cents + '¢', 'Cost per message', 'About ' + Math.round(s.latency_s.p50) + ' seconds each'));
  }
  $('eval-grid').replaceChildren(...cards);
  renderHardCases();
}

function renderHardCases() {
  const ids = Object.keys(samples).filter(id => SHOWCASE_TITLES[id]);
  if (!ids.length) return;
  $('case-chips').replaceChildren(...ids.map(id => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'case-chip';
    chip.textContent = SHOWCASE_TITLES[id];
    chip.addEventListener('click', () => openCase(id));
    return chip;
  }));
  $('hard-cases').hidden = false;
}

function openCase(id) {
  $('scenario').value = id;
  resetDemo();
  showHandoff();
  $('work-sample').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  $('scenario').focus({ preventScroll: true });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function copyText(text, status, success) {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = 'Copy is unavailable in this browser. Select and copy the text shown here: ' + text; }
}

const REVIEW_MINUTES = 1;
const WEEKS_PER_YEAR = 52;
const HOURS_PER_WORKDAY = 8;
const usd = digits => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits });

function netMinutes() {
  const saved = [...document.querySelectorAll('input[name="saver"]:checked')].reduce((sum, box) => sum + Number(box.value), 0);
  return Math.max(0, saved - REVIEW_MINUTES);
}

function calculate() {
  const r = Number($('requests').value);
  const m = netMinutes();
  const rateInput = $('rate');
  const rateValid = rateInput.value !== '' && rateInput.checkValidity();
  $('requests-out').textContent = r;
  $('net-minutes').textContent = m + ' min';
  $('value-error').hidden = rateValid;
  rateInput.setAttribute('aria-invalid', String(!rateValid));

  const hoursYear = r * m * WEEKS_PER_YEAR / 60;
  $('hours').textContent = (r * m * 4 / 60).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('hours-year').textContent = Math.round(hoursYear).toLocaleString('en-US') + ' hours';
  $('days-year').textContent = Math.round(hoursYear / HOURS_PER_WORKDAY).toLocaleString('en-US') + ' days';
  $('value-year').textContent = rateValid ? usd(0).format(hoursYear * Number(rateInput.value)) + ' / yr' : '—';
  $('value-formula').textContent = r + ' requests × ' + m + ' min × ' + WEEKS_PER_YEAR + ' weeks ÷ 60';

  if (results && results.summary.cost_usd) {
    const perInquiry = results.summary.cost_usd.per_inquiry;
    $('ai-year').textContent = usd(0).format(r * WEEKS_PER_YEAR * perInquiry) + ' / yr';
    $('value-cost').hidden = false;
    $('value-cost').textContent = 'AI cost uses the measured $' + perInquiry.toFixed(3) + ' per message from the practice test.';
  }
}

/* ---------- Hero: one inquiry moving through the workflow ---------- */
const FLOWS = {
  quote: {
    text: '“We’re planning an office build-out in Tampa next quarter and need power and data cabling. We can share the floor plan.”',
    capture: [['Service', 'Power + data cabling'], ['Location', 'Tampa'], ['Timing', 'Next quarter']],
    triageTitle: 'The next step is clear.',
    triage: [['Goes to', 'Estimator'], ['Urgency', 'Routine'], ['Missing', 'Nothing']],
    approveTitle: 'A person signs off.',
    approveText: 'Draft reply ready. Nothing is sent until someone on the team approves it.',
    canApprove: true
  },
  missing: {
    text: '“I’m interested in getting a generator installed at my house. Can you send me a price?”',
    capture: [['Service', 'Home standby generator'], ['Location', null], ['Timing', null]],
    triageTitle: 'The gaps are flagged.',
    triage: [['Goes to', 'Office intake'], ['Urgency', 'Routine'], ['Missing', 'City · timing']],
    approveTitle: 'A person signs off.',
    approveText: 'Draft asks for the city and timing. No price is guessed or promised.',
    canApprove: true
  },
  urgent: {
    text: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    capture: [['Service', 'Reported hazard at a panel'], ['Location', null], ['Timing', 'Today']],
    triageTitle: 'Flagged as an emergency.',
    triage: [['Goes to', 'A person, right away'], ['Urgency', 'Emergency'], ['Queue', 'Skipped']],
    approveTitle: 'No automated reply.',
    approveText: 'It goes straight to a person through the urgent-contact procedure. No AI advice is given.',
    canApprove: false
  }
};
const FLOW_STEP_MS = 1100;
const flowState = { key: 'quote', timers: [] };

function chipList(pairs) {
  return pairs.map(([label, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value || 'Not given';
    if (!value) row.className = 'is-missing';
    row.append(dt, dd);
    return row;
  });
}

function clearFlowTimers() {
  flowState.timers.forEach(clearTimeout);
  flowState.timers = [];
}

function renderFlow(key, animate) {
  const flow = FLOWS[key];
  const nodes = [...document.querySelectorAll('.flow-steps .map-node')];
  flowState.key = key;
  clearFlowTimers();
  document.querySelectorAll('.flow-picker button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.flow === key)));
  $('flow').classList.toggle('is-urgent', key === 'urgent');
  $('flow-text').textContent = flow.text;
  $('flow-capture').replaceChildren(...chipList(flow.capture));
  $('flow-triage').replaceChildren(...chipList(flow.triage));
  $('flow-triage-title').textContent = flow.triageTitle;
  $('flow-approve-title').textContent = flow.approveTitle;
  $('flow-approve-text').textContent = flow.approveText;
  $('flow-approve').hidden = !flow.canApprove;
  $('flow-approve').disabled = false;
  $('flow-approve').innerHTML = 'Approve the draft <span aria-hidden="true">→</span>';
  $('flow-status').textContent = '';

  if (!animate) {
    nodes.forEach(node => { node.classList.remove('is-active'); node.classList.add('is-done'); });
    return;
  }
  nodes.forEach(node => node.classList.remove('is-done', 'is-active'));
  nodes.forEach((node, i) => {
    flowState.timers.push(setTimeout(() => {
      nodes.forEach(n => n.classList.remove('is-active'));
      node.classList.add('is-done', 'is-active');
    }, FLOW_STEP_MS * (i + 1)));
  });
}

/* The hero never moves on its own; it only animates after a visitor picks an example. */
function setupFlow() {
  const animate = !prefersReducedMotion();
  document.querySelectorAll('.flow-picker button').forEach(btn => btn.addEventListener('click', () => {
    renderFlow(btn.dataset.flow, animate);
  }));
  $('flow-approve').addEventListener('click', () => {
    clearFlowTimers();
    document.querySelectorAll('.flow-steps .map-node').forEach(n => { n.classList.remove('is-active'); n.classList.add('is-done'); });
    $('flow-approve').disabled = true;
    $('flow-approve').innerHTML = 'Approved by a person <span aria-hidden="true">✓</span>';
    $('flow-status').textContent = 'Approved. In the real workflow the reply would now be sent and the correction log updated.';
  });
  renderFlow('quote', false);
}

/* ---------- Opportunity: today vs. proposed ---------- */
function setupOpportunityToggles() {
  document.querySelectorAll('.opp').forEach(article => {
    article.querySelectorAll('.view-toggle button').forEach(btn => btn.addEventListener('click', () => {
      article.dataset.view = btn.dataset.view;
      article.querySelectorAll('.view-toggle button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    }));
  });
}

setupDemo();
resetDemo();
renderResults();
calculate();
setupFlow();
setupOpportunityToggles();
$('scenario').addEventListener('change', resetDemo);
$('prepare').addEventListener('click', showHandoff);
$('copy-draft').addEventListener('click', () => copyText($('result-draft').textContent, $('copy-status'), 'Copied. Nothing has been sent.'));
$('share').addEventListener('click', () => {
  if (location.protocol === 'file:') {
    $('share-status').textContent = 'This is a local preview. Open the published website to copy a shareable link.';
    return;
  }
  copyText(location.href.split('#')[0], $('share-status'), 'Proposal link copied. Ready to share.');
});
$('value-form').addEventListener('input', calculate);
$('value-form').addEventListener('submit', e => e.preventDefault());
