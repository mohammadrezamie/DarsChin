import { describe, expect, it } from 'vitest';
import type { AcademicRule, AuditLog } from '../src/types';
import {
  academicRulesRevision, expectedAcademicRevision, appendAcademicRuleEvent,
  readAcademicRuleHistory, latestRuleEvent, checkAcademicRuleRevert,
} from '../server/services/academic-rule-history';

const a = (id: string, from: string, to: string, curriculumId='chart'): AcademicRule => ({
  id, curriculumId, targetCourseId:to,relationshipType:'PREREQUISITE',
  expression:{type:'COURSE',courseId:from},
});
const log=():AuditLog[]=>[];

describe('academic rules: revisions and persistent journal', () => {
  it('hashes only the exact chart, ignoring ordering but detecting any rule change',()=>{
    const first=a('r1','math','signal'),second=a('r2','signal','control');
    const another=a('foreign','x','y','other-chart');
    const h=academicRulesRevision('chart',[first,second]);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(academicRulesRevision('chart',[another,second,first])).toBe(h);
    expect(academicRulesRevision('chart',[first])).not.toBe(h);
    expect(academicRulesRevision('chart',[first,{...second,notes:'changed'}])).not.toBe(h);
  });

  it('rejects an invalid concurrency precondition without treating it as missing',()=>{
    expect(expectedAcademicRevision(undefined)).toBeNull();
    expect(expectedAcademicRevision('none')).toBe('invalid');
    expect(expectedAcademicRevision('a'.repeat(64))).toBe('a'.repeat(64));
    expect(expectedAcademicRevision(['a'.repeat(64)])).toBe('invalid');
  });

  it('records the actual actor, before/after versions and exact snapshots for undo',()=>{
    const rules:AcademicRule[]=[];
    const before=academicRulesRevision('chart',rules);
    const rule=a('first','a','b');
    rules.push(rule);
    const after=academicRulesRevision('chart',rules);
    const entries=log();
    const event=appendAcademicRuleEvent(entries,'manager','chart','ADD',rule,before,after);
    expect(entries).toHaveLength(1);
    expect(event.action).toBe('ACADEMIC_RULE_ADDED');
    expect(readAcademicRuleHistory(event)).toMatchObject({schema:1,rule,kind:'ADD',
      beforeRevision:before,afterRevision:after});
    expect(latestRuleEvent(entries,'chart')?.log.id).toBe(event.id);
  });

  it('prevents another administrator from silently undoing an existing rule',()=>{
    const rules=[a('r','a','b')],entries=log();
    const previous=academicRulesRevision('chart',[]);
    const next=academicRulesRevision('chart',rules);
    const event=appendAcademicRuleEvent(entries,'admin-A','chart','ADD',rules[0],previous,next);
    const foreign=checkAcademicRuleRevert(entries,rules,'chart',event.id,'admin-B',false);
    expect(foreign.ok).toBe(false);
    const root=checkAcademicRuleRevert(entries,rules,'chart',event.id,'root',true);
    expect(root).toMatchObject({ok:true,reverseKind:'DELETE'});
  });

  it('rejects stale undo after someone else adds a new rule and rejects ABA reverts',()=>{
    const first=a('r1','a','b'),second=a('r2','b','c');
    const rules=[first],entries=log();
    const begin=academicRulesRevision('chart',[]);
    const firstRevision=academicRulesRevision('chart',rules);
    const one=appendAcademicRuleEvent(entries,'manager','chart','ADD',first,begin,firstRevision);
    rules.push(second);
    const secondRevision=academicRulesRevision('chart',rules);
    appendAcademicRuleEvent(entries,'manager','chart','ADD',second,firstRevision,secondRevision);
    expect(checkAcademicRuleRevert(entries,rules,'chart',one.id,'manager',false).ok).toBe(false);
    // Returning to a matching content digest must not resurrect a stale event.
    rules.pop();
    expect(academicRulesRevision('chart',rules)).toBe(firstRevision);
    expect(checkAcademicRuleRevert(entries,rules,'chart',one.id,'manager',false).ok).toBe(false);
  });

  it('undoes ADD and permits REDO as a new, fully audited inverse event',()=>{
    const original=a('original','a','b'),rules=[original],entries=log();
    const before=academicRulesRevision('chart',[]);
    const after=academicRulesRevision('chart',rules);
    const added=appendAcademicRuleEvent(entries,'manager','chart','ADD',original,before,after);
    const undo=checkAcademicRuleRevert(entries,rules,'chart',added.id,'manager',false);
    expect(undo).toMatchObject({ok:true,reverseKind:'DELETE'});
    rules.pop();
    const reversed=appendAcademicRuleEvent(entries,'manager','chart','DELETE',original,
      after,academicRulesRevision('chart',rules),added.id);
    expect(reversed.action).toBe('ACADEMIC_RULE_REVERTED');
    expect(readAcademicRuleHistory(reversed)?.revertedEventId).toBe(added.id);
    const redo=checkAcademicRuleRevert(entries,rules,'chart',reversed.id,'manager',false);
    expect(redo).toMatchObject({ok:true,reverseKind:'ADD'});
  });

  it('never reverts snapshots that conflict with the real current rules or charts',()=>{
    const rule=a('r','a','b'),logs=log(),rules=[rule];
    const before=academicRulesRevision('chart',[]);
    const after=academicRulesRevision('chart',rules);
    const event=appendAcademicRuleEvent(logs,'manager','chart','ADD',rule,before,after);
    expect(checkAcademicRuleRevert(logs,[], 'chart',event.id,'manager',false).ok).toBe(false);
    const corrupted=log();corrupted.push({...event,details:'{invalid'});
    expect(latestRuleEvent(corrupted,'chart')).toBeNull();
    expect(checkAcademicRuleRevert(logs,rules,'wrong-chart',event.id,'manager',false).ok).toBe(false);
  });
});
