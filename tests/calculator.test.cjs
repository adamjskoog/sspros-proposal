const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTimeEstimate } = require('../calculator.js');
const base = { requests: 20, saved: 9, review: 2, corrections: 1, maintenance: 2, setup: 8, rate: 30 };

test('deducts per-message work, annual maintenance, and first-year setup', () => {
  const value = calculateTimeEstimate(base, 0.01857);
  assert.equal(value.netMinutes, 6);
  assert.equal(value.ongoingHours, 80);
  assert.equal(value.firstYearHours, 72);
  assert.equal(value.timeValue, 2160);
  assert.ok(Math.abs(value.modelCost - 19.3128) < 0.00001);
});
test('preserves negative results when review takes longer than the saving', () => {
  const value = calculateTimeEstimate({ ...base, saved: 1, review: 4 });
  assert.equal(value.netMinutes, -4);
  assert.ok(value.firstYearHours < -100);
  assert.ok(value.timeValue < 0);
});
test('zero traffic still carries maintenance and setup overhead', () => {
  const value = calculateTimeEstimate({ ...base, requests: 0 }, 0.01857);
  assert.equal(value.firstYearHours, -32);
  assert.equal(value.modelCost, 0);
});
test('allows exact break-even, zero hourly value, and unknown model cost', () => {
  const value = calculateTimeEstimate({ ...base, saved: 3, maintenance: 0, setup: 0, rate: 0 });
  assert.equal(value.firstYearHours, 0);
  assert.equal(value.timeValue, 0);
  assert.equal(value.modelCost, null);
});
test('rejects invalid numeric input instead of presenting NaN or false savings', () => {
  for (const invalid of [NaN, Infinity, -1, '9']) assert.throws(() => calculateTimeEstimate({ ...base, saved: invalid }), RangeError);
  assert.throws(() => calculateTimeEstimate(base, -0.01), RangeError);
});
