'use strict';

// Time capacity, not cash savings. Setup applies only to the first year.
function calculateTimeEstimate(values, perInquiry = null) {
  for (const key of ['requests', 'saved', 'review', 'corrections', 'maintenance', 'setup', 'rate']) {
    if (!Number.isFinite(values[key]) || values[key] < 0) throw new RangeError('Invalid ' + key);
  }
  if (perInquiry !== null && (!Number.isFinite(perInquiry) || perInquiry < 0)) throw new RangeError('Invalid model cost');
  const netMinutes = values.saved - values.review - values.corrections;
  const ongoingHours = values.requests * netMinutes * 52 / 60 - values.maintenance * 12;
  const firstYearHours = ongoingHours - values.setup;
  return {
    netMinutes, ongoingHours, firstYearHours,
    timeValue: firstYearHours * values.rate,
    modelCost: perInquiry === null ? null : values.requests * 52 * perInquiry
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { calculateTimeEstimate };
