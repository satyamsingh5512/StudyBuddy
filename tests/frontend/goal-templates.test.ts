import test from 'node:test';
import assert from 'node:assert/strict';
import { GOAL_TEMPLATES, templateToGoal } from '../../src/lib/goalTemplates.ts';

test('all six local templates are present and produce valid timelines', () => {
  assert.deepEqual(GOAL_TEMPLATES.map(item=>item.id),['jee','neet','upsc','gate','cat','custom']);
  for(const template of GOAL_TEMPLATES){
    const goal=templateToGoal(template,'2026-08-07');
    assert.ok(goal.title.length<=200);
    assert.ok(goal.description.length<=2000);
    if(goal.targetDate)assert.ok(goal.targetDate>=goal.startDate);
    if(goal.completionPolicy==='auto')assert.ok(goal.subGoals.length>0);
  }
});

test('custom template remains blank and editable',()=>{
  const custom=templateToGoal(GOAL_TEMPLATES.find(item=>item.id==='custom')!,'2026-08-07');
  assert.equal(custom.title,'');
  assert.equal(custom.targetDate,null);
  assert.deepEqual(custom.subGoals,[]);
});
