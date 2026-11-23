import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLimitationDeadline } from './limitationCalculator';

test('Arbitration Act Sec. 34 computes 3 months + strict 30-day condonable cap', () => {
  const res = calculateLimitationDeadline('arb_sec_34', '2026-01-31', '2026-04-20');
  // Jan 31 + 3 months clamps to Apr 30 (Thursday)
  assert.equal(res.rawDueDate, '2026-04-30');
  assert.equal(res.effectiveDueDate, '2026-04-30');
  assert.equal(res.rolledOverFromSunday, false);
  // Apr 30 + 30 days = May 30 (Saturday)
  assert.equal(res.graceDeadlineDate, '2026-05-30');
  assert.equal(res.daysRemaining, 10);
  assert.equal(res.urgencyStatus, 'approaching');
});

test('Limitation Act Sec. 4 rolls Sunday due dates forward to Monday', () => {
  // 2026-08-02 is a Sunday (2026-05-04 + 90 days = 2026-08-02)
  const res = calculateLimitationDeadline('hc_appeal_116a', '2026-05-04', '2026-07-30');
  assert.equal(res.rawDueDate, '2026-08-02');
  assert.equal(res.effectiveDueDate, '2026-08-03');
  assert.equal(res.rolledOverFromSunday, true);
  assert.equal(res.daysRemaining, 4);
  assert.equal(res.urgencyStatus, 'urgent');
});

test('Overdue status is flagged when reference date is past effective due date', () => {
  const res = calculateLimitationDeadline('review_124', '2026-01-01', '2026-03-01');
  assert.equal(res.urgencyStatus, 'overdue');
  assert.ok(res.daysRemaining < 0);
});
