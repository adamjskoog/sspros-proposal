'use strict';
const samples = {
  commercial: {
    title: 'Commercial build-out',
    message: '“We’re planning an office build-out in Tampa and need help with power and data cabling. We’re aiming for next quarter. We can share the floor plan. Email is best.”',
    service: 'Commercial electrical + cabling', location: 'Tampa · coverage to confirm', timing: 'Next quarter · dates to confirm', owner: 'Commercial estimator · proposed',
    action: 'Confirm service fit and coverage, request the floor plan, and assign an estimator before discussing a visit.',
    draft: 'Thanks for reaching out about your office build-out. Could you share the floor plan and the target project dates? Our team can then review the power and cabling scope and advise on the next step.',
    review: 'A team member would confirm the service scope, coverage, and wording before sending. No price or availability has been promised.', badge: 'Team review needed', copyLabel: 'Copy draft ↗', draftLabel: 'RESPONSE DRAFT · NOT SENT'
  },
  missing: {
    title: 'Request with missing details', message: '“I’m interested in getting a generator installed. Can you send me a price?”',
    service: 'Generator inquiry · scope unconfirmed', location: 'Not provided', timing: 'Not provided', owner: 'Office intake · proposed',
    action: 'Ask for the project city or ZIP, property type, preferred contact method, and timing. Route pricing questions to the estimator.',
    draft: 'Thanks for your interest in a generator installation. Please share your project city or ZIP, whether this is for a home or business, your preferred contact method, and your target timing. The team can review the details and advise what is needed for an estimate.',
    review: 'Missing details stay visible. The workflow does not invent a location, estimate, equipment recommendation, or appointment.', badge: 'More details needed', copyLabel: 'Copy draft ↗', draftLabel: 'RESPONSE DRAFT · NOT SENT'
  },
  urgent: {
    title: 'Urgent electrical concern', message: '“There’s a burning smell near the electrical panel at our property. Can someone come today?”',
    service: 'Reported urgent electrical concern', location: 'Not provided', timing: 'Customer requests today', owner: 'Designated human responder',
    action: 'Escalate to a person through the company’s agreed urgent-contact procedure. Do not place this in the ordinary estimate workflow.',
    draft: 'Human review required: the customer reports a burning smell near an electrical panel and requests help today. Location and callback details are missing. Follow the company’s approved urgent-response procedure; no dispatch or availability has been confirmed.',
    review: 'Internal handoff only. No troubleshooting, safety assessment, automated customer reply, or dispatch commitment is produced.', badge: 'Human escalation', copyLabel: 'Copy internal note ↗', draftLabel: 'INTERNAL HANDOFF · NOT A CUSTOMER REPLY'
  }
};
const $ = id => document.getElementById(id);
function resetDemo(){
  const sample=samples[$('scenario').value];
  $('sample-title').textContent=sample.title;
  $('sample-message').textContent=sample.message;
  $('demo-empty').hidden=false;
  $('demo-result').hidden=true;
  $('prepare').innerHTML='Prepare the handoff <span aria-hidden="true">→</span>';
  $('copy-status').textContent='';
}
$('scenario').addEventListener('change',resetDemo);
$('prepare').addEventListener('click',()=>{
  const sample=samples[$('scenario').value];
  for(const key of ['service','location','timing','owner','action','draft','review']) $('result-'+key).textContent=sample[key];
  $('review-badge').textContent=sample.badge;
  $('review-badge').classList.toggle('urgent',$('scenario').value==='urgent');
  $('draft-label').textContent=sample.draftLabel;
  $('copy-draft').textContent=sample.copyLabel;
  $('demo-empty').hidden=true;
  $('demo-result').hidden=false;
  $('prepare').innerHTML='Handoff prepared <span aria-hidden="true">✓</span>';
  $('copy-status').textContent='';
});
async function copyText(text,status,success){
  try{await navigator.clipboard.writeText(text);status.textContent=success;}
  catch{status.textContent='Copy is unavailable in this browser. Select and copy the text shown here: '+text;}
}
$('copy-draft').addEventListener('click',()=>copyText($('result-draft').textContent,$('copy-status'),'Copied. Nothing has been sent.'));
$('share').addEventListener('click',()=>{
  if(location.protocol==='file:'){
    $('share-status').textContent='This is a local preview. Open the published website to copy a shareable link.';
    return;
  }
  copyText(location.href.split('#')[0],$('share-status'),'Proposal link copied. Ready to share.');
});
const tabs=[...document.querySelectorAll('[role="tab"]')];
function activateTab(tab,focus=false){
  tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;$(t.getAttribute('aria-controls')).hidden=!selected;});
  if(focus)tab.focus();
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>activateTab(tab));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=(index+1)%tabs.length;
    if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=tabs.length-1;
    if(next!==undefined){event.preventDefault();activateTab(tabs[next],true);}
  });
});
function calculate(){
  const requests=$('requests'),minutes=$('minutes');
  const valid=requests.checkValidity()&&minutes.checkValidity();
  $('value-error').hidden=valid;
  requests.setAttribute('aria-invalid',String(!requests.checkValidity()));
  minutes.setAttribute('aria-invalid',String(!minutes.checkValidity()));
  if(!valid){$('hours').textContent='—';$('value-formula').textContent='Update the assumptions to calculate a scenario.';return;}
  const r=Number(requests.value),m=Number(minutes.value);
  $('hours').textContent=(r*m*4/60).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  $('value-formula').textContent=r+' requests × '+m+' minutes × 4 weeks ÷ 60';
}
$('value-form').addEventListener('input',calculate);
$('value-form').addEventListener('submit',e=>e.preventDefault());
