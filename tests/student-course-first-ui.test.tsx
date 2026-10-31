import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassedCoursesManager } from '../src/components/PassedCoursesManager';
import { StudentWishlistBuilder } from '../src/components/StudentWishlistBuilder';
import { studentWorkspaceFromSearch } from '../src/utils/student-workspace-navigation';
const source=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('one course-first student workspace and real semester transcript',()=>{
  it('routes legacy recommendations and wishlist links to the same selection screen',()=>{
    expect(studentWorkspaceFromSearch('?tab=wishlist')).toBe('offerings');
    expect(studentWorkspaceFromSearch('?tab=recommendations')).toBe('offerings');
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('انتخاب درس پیش از مقایسهٔ استاد و گروه');
    expect(dashboard).toContain('<StudentWishlistBuilder');
    expect(dashboard).toContain('<OfferingsList');
    expect(dashboard).not.toContain("activeTab === 'recommendations'");
    expect(dashboard).not.toContain("activeTab === 'wishlist'");
    const dock=source('src/components/StudentMobileDock.tsx');
    expect(dock).toContain('کارنامهٔ من');
    expect(dock).not.toContain("id: 'recommendations'");
    expect(dock).not.toContain("id: 'wishlist'");
  });
  it('shows course choice before instructor and timetable rather than forcing a group upfront',()=>{
    const s=source('src/components/StudentDashboard.tsx');
    expect(s.indexOf('<StudentWishlistBuilder')).toBeLessThan(s.indexOf('<OfferingsList'));
    expect(s).toContain('wishlistCourseIds.length > 0 || selectedOfferingIds.length > 0');
    expect(source('src/components/OfferingsList.tsx')).toContain('?? false; // Course first');
    const html=renderToStaticMarkup(<StudentWishlistBuilder curriculumId={null}
      wishlistCourseIds={[]}evaluations={[]}recommendations={[]}onSave={async()=>true}/>);
    expect(html).toContain('اول درس‌هایی را که می‌خواهی انتخاب کن');
    expect(html).toContain('انتخاب واحد نهایی نیستند');
  });
  it('renders a transcript by term, and keeps edit and delete affordances',()=>{
    const html=renderToStaticMarkup(<PassedCoursesManager/>);
    expect(html).toContain('کارنامهٔ تحصیلی من');
    expect(html).toContain('ثبت نتیجهٔ درس');
    const s=source('src/components/PassedCoursesManager.tsx');
    expect(s).toContain("setTermChoice(row.termId?'__manual':'')");
    expect(s).toContain('EXCUSED_EXAM_ABSENCE');
    expect(s).toContain('CLASS_ABSENCE_DROP');
    expect(s).toContain('ویرایش');
    expect(s).toContain("method:editingId?'PUT':'POST'");
    expect(s).toContain('نیمسال نامشخص (سوابق قدیمی)');
  });
});
