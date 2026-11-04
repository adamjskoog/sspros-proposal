'use strict';
const $ = id => document.getElementById(id);
const results = window.EVAL_RESULTS || null;

/* Explicitly illustrative fallback when recorded results are unavailable. */
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
    review: 'Missing details stay visible. A person must check facts, prices, and any scheduling language.', badge: 'More details needed', urgent: false
  },
  urgent: {
    title: 'Urgent electrical concern', message: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    service: 'Reported hazard at a panel', location: 'Not provided', timing: 'Today', owner: 'Person, immediately',
    action: 'Escalate through the company’s urgent-contact procedure. Do not place in the estimate queue.',
    draft: null,
    review: 'No automated reply, troubleshooting, or safety advice is produced for hazards.', badge: 'Human escalation', urgent: true
  }
};

const CASE_TITLES = {
  C01: 'Commercial build-out', C18: 'Request with missing details', C21: 'Urgent electrical concern',
  C25: 'Emergency written in Spanish', C26: 'Emergency within a quote request',
  C34: 'Attempt to insert a fake price', C36: 'Instructions hidden in an off-topic request',
  C19: 'Request about a tripping breaker', C37: 'Request with almost no detail'
};
const ROUTES = { estimator: 'Estimator', office_intake: 'Office intake', human_escalation: 'Human escalation', out_of_scope: 'Out-of-scope review', spam: 'Spam review' };
const FIELD_LABELS = { location: 'location', timing: 'timing', property_type: 'property type', scope_details: 'scope details' };
function fromEval(item) {
  const h = item.handoff;
  return {
    title: CASE_TITLES[item.id], message: '“' + item.inquiry + '”', service: h.service_summary,
    location: h.location || 'Not provided', timing: h.timing || 'Not provided', owner: ROUTES[h.route] || h.route,
    action: h.next_action, draft: h.draft_reply,
    missing: h.missing_fields.length ? h.missing_fields.map(field => FIELD_LABELS[field] || field).join(', ') : 'None listed by the model',
    review: [h.reviewer_notes, item.passed ? 'Passed the revised automatic checks; human review is still required.' : 'One or more revised automatic checks failed. Review this answer.'].filter(Boolean).join('\n\n'),
    badge: h.route === 'human_escalation' ? 'Human escalation' : h.missing_fields.length ? 'More details needed' : 'Human review needed',
    urgent: h.route === 'human_escalation'
  };
}
const available = new Map((Array.isArray(results?.cases) ? results.cases : []).filter(item => item?.handoff && Array.isArray(item.handoff.missing_fields)).map(item => [item.id, item]));
const recorded = Object.fromEntries(Object.keys(CASE_TITLES).filter(id => available.has(id)).map(id => [id, fromEval(available.get(id))]));
const samples = Object.keys(recorded).length ? recorded : presets;
const isRecorded = samples === recorded;
const dateLabel = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function setupDemo() {
  $('scenario').replaceChildren(...Object.entries(samples).map(([id, sample]) => new Option(sample.title, id)));
  if (isRecorded) {
    $('demo-mode').textContent = 'Recorded AI answers';
    $('demo-source').textContent = 'Fictional messages · generated ' + dateLabel(results.meta.run_at);
    $('sample-note').textContent = 'Displays the saved answer, not a new AI request. Model: ' + results.meta.model + '.';
  } else {
    $('demo-mode').textContent = 'Illustrative fallback';
    $('demo-source').textContent = 'Recorded results unavailable · preset examples only';
    $('sample-note').textContent = 'This is an authored illustration, not a recorded or newly generated AI answer.';
  }
}
function resetDemo() {
  const sample = samples[$('scenario').value];
  $('sample-title').textContent = sample.title;
  $('sample-message').textContent = sample.message;
  $('demo-empty').hidden = false;
  $('demo-result').hidden = true;
  $('prepare').textContent = isRecorded ? 'View saved result →' : 'View illustrative result →';
  $('copy-status').textContent = '';
  $('review-example').hidden = isRecorded ? $('scenario').value !== 'C01' : $('scenario').value !== 'commercial';
}
function showHandoff() {
  const sample = samples[$('scenario').value];
  for (const key of ['service', 'location', 'timing', 'owner', 'action', 'review']) $('result-' + key).textContent = sample[key];
  const hasDraft = Boolean(sample.draft);
  $('result-draft').textContent = hasDraft ? sample.draft : 'No customer reply was drafted. A person handles this route.';
  $('draft-label').textContent = hasDraft ? 'SAVED DRAFT · NOT SENT' : 'NO AUTOMATED REPLY';
  if (!isRecorded && hasDraft) $('draft-label').textContent = 'ILLUSTRATIVE DRAFT · NOT SENT';
  $('result-missing').textContent = 'Missing information: ' + (sample.missing || 'See the illustrative next step.');
  $('copy-draft').hidden = !hasDraft;
  $('review-badge').textContent = sample.badge;
  $('review-badge').classList.toggle('urgent', sample.urgent);
  $('demo-empty').hidden = true;
  $('demo-result').hidden = false;
  $('prepare').textContent = 'Result shown ✓';
}
function metric(value, label, note) {
  const card = document.createElement('div'); card.className = 'eval-metric';
  for (const [tag, text] of [['strong',value], ['span',label], ['small',note]]) {
    const element = document.createElement(tag); element.textContent = text; card.append(element);
  }
  return card;
}
function renderResults() {
  if (!results?.summary || !results?.meta) return;
  const s = results.summary;
  $('eval-meta').textContent = s.cases + ' author-written fictional cases · generated ' + dateLabel(results.meta.run_at) + (results.meta.regraded_at ? ' · regraded ' + dateLabel(results.meta.regraded_at) : '');
  $('eval-grid').replaceChildren(
    metric(s.all_checks_passed.passed + '/' + s.cases, 'Passed automatic checks', 'Selected labels, timing, consistency, and restricted wording'),
    metric(s.emergency_recall.passed + '/' + s.emergency_recall.total, 'Labeled urgent cases escalated', 'Under the fictional test’s policy; not a safety certification'),
    metric(String(s.unsafe_drafts), 'Drafts flagged by wording scan', 'A limited scan can miss unsupported or inappropriate statements')
  );
  const difficult = Object.keys(recorded).filter(id => !['C01','C18','C21'].includes(id));
  $('case-chips').replaceChildren(...difficult.map(id => {
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'case-chip'; chip.textContent = CASE_TITLES[id];
    chip.addEventListener('click', () => {
      $('scenario').value = id; resetDemo(); showHandoff();
      $('work-sample').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      $('scenario').focus({ preventScroll: true });
    }); return chip;
  }));
  $('hard-cases').hidden = !difficult.length;
}
async function copyText(text, status, success) {
  try { await navigator.clipboard.writeText(text); status.textContent = success; }
  catch { status.textContent = 'Copy is unavailable. Select and copy this text: ' + text; }
}
function calculate() {
  const ids = {requests:'requests',manual:'manual',assisted:'assisted',maintenance:'maintenance',setup:'setup',rate:'rate',tools:'tool-spend'};
  const values = {}; const problems = []; let valid = true;
  for (const [name,id] of Object.entries(ids)) {
    const input = $(id);
    const ok = input.value.trim() !== '' && input.checkValidity() && Number.isFinite(Number(input.value));
    input.setAttribute('aria-invalid',String(!ok)); valid = valid && ok; values[name] = Number(input.value);
    if (!ok) problems.push(input.labels[0].textContent.trim() + ': enter a number from ' + input.min + ' to ' + input.max + ', in increments of ' + input.step + '.');
  }
  const answer = valid ? window.ProposalValue.estimate(values) : null;
  $('value-error').hidden = Boolean(answer);
  $('value-error').textContent = problems.join(' ') || 'Check the highlighted values before calculating this scenario.';
  const number = value => value.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  for (const [id,text] of Object.entries(answer ? {'hours':number(answer.hours),'first-month':number(answer.firstMonth),'capacity-value':money(answer.capacity),'net-value':money(answer.netValue)} : {'hours':'—','first-month':'—','capacity-value':'—','net-value':'—'})) $(id).textContent = text;
  $('value-formula').textContent = answer ? values.requests + ' requests × (' + values.manual + ' − ' + values.assisted + ') minutes × 52 ÷ 12 ÷ 60 − ' + values.maintenance + ' maintenance hours per month.' : 'Correct the highlighted input to calculate this scenario.';
}
setupDemo(); resetDemo(); renderResults(); calculate();
$('scenario').addEventListener('change', resetDemo);
$('prepare').addEventListener('click', showHandoff);
$('copy-draft').addEventListener('click', () => copyText($('result-draft').textContent, $('copy-status'), 'Copied. Nothing has been sent.'));
$('share').addEventListener('click', () => {
  if (location.protocol === 'file:' || ['localhost','127.0.0.1'].includes(location.hostname)) { $('share-status').textContent = 'This is a local preview. Use the published proposal address after release.'; return; }
  copyText(location.href.split('#')[0], $('share-status'), 'Proposal link copied.');
});
$('value-form').addEventListener('input',calculate);
$('value-form').addEventListener('submit',event => event.preventDefault());
document.querySelectorAll('.opp').forEach(article => {
  article.querySelectorAll('.view-toggle button').forEach(button => button.addEventListener('click', () => {
    article.dataset.view = button.dataset.view;
    article.querySelectorAll('.view-toggle button').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  }));
});
document.querySelectorAll('a[href="#value-form"]').forEach(link => link.addEventListener('click', () => { $('value-panel').open = true; }));
if (['#value-form','#value-panel'].includes(location.hash)) $('value-panel').open = true;
