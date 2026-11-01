import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { PassedCoursesManager,isCompletedCourse } from '../src/components/PassedCoursesManager';
import type { StudentPassedCourse } from '../src/types';

const attempt=(status:'PASSED'|'FAILED'|'ABSENT',grade:number):StudentPassedCourse=>
  ({id:'attempt',userId:'student',courseId:'course',status,grade,passedAt:''});

describe('passed-course UI never mistakes a failed attempt for completed credit',()=>{
  it('requires both a nonfailed status and a passing grade',()=>{
    expect(isCompletedCourse(attempt('PASSED',9))).toBe(false);
    expect(isCompletedCourse(attempt('FAILED',18))).toBe(false);
    expect(isCompletedCourse(attempt('ABSENT',19))).toBe(false);
    expect(isCompletedCourse(attempt('PASSED',15))).toBe(true);
  });
  it('labels transcript records as self-reported rather than an official academic certification',()=>{
    const html=renderToStaticMarkup(<PassedCoursesManager/>);
    expect(html).toContain('خوداظهاری');
    expect(html).toContain('مردودی');
  });
});
