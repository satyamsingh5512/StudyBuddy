import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, calendarRange, datesInRange, isActivityEligible, mondayOnOrBefore, rangeDays } from '../../src/lib/goalDates.ts';
import type { Goal } from '../../src/types/goals.ts';

const goal: Goal = { id:'g',definitionVersion:1,title:'Goal',status:'active',gridMode:'daily',completionPolicy:'manual',startDate:'2026-08-01',targetDate:'2026-08-31',subGoals:[],milestones:[],createdAt:'',updatedAt:'' };

test('calendar ranges are Monday aligned and bounded to twelve weeks', () => {
  const range=calendarRange('2026-08-07');
  assert.equal(mondayOnOrBefore(range.from),range.from);
  assert.equal(rangeDays(range),84);
  assert.equal(datesInRange(range).length,84);
});

test('calendar addition crosses month and leap-day boundaries', () => {
  assert.equal(addCalendarDays('2024-02-28',1),'2024-02-29');
  assert.equal(addCalendarDays('2024-02-29',1),'2024-03-01');
});

test('activity is limited by timeline, today, and weekly Mondays', () => {
  assert.equal(isActivityEligible(goal,'2026-08-07','2026-08-07'),true);
  assert.equal(isActivityEligible(goal,'2026-07-31','2026-08-07'),false);
  assert.equal(isActivityEligible(goal,'2026-08-08','2026-08-07'),false);
  assert.equal(isActivityEligible({...goal,gridMode:'weekly'},'2026-08-03','2026-08-07'),true);
  assert.equal(isActivityEligible({...goal,gridMode:'weekly'},'2026-08-04','2026-08-07'),false);
});
