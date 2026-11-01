import * as jalaali from 'jalaali-js';

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return [gy, gm, gd];
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

export function generateExamsICS(courses: any[]): string {
  let ics = 'BEGIN:VCALENDAR\r\n';
  ics += 'VERSION:2.0\r\n';
  ics += 'PRODID:-//Darschyn//Exam Schedule//FA\r\n';
  ics += 'CALSCALE:GREGORIAN\r\n';

  for (const course of courses) {
    if (!course.examDate) continue;

    // Try to parse examDate (e.g., "1403/10/24", "1403/10/24 10:00")
    const dateMatch = course.examDate.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) continue;

    const jy = parseInt(dateMatch[1], 10);
    const jm = parseInt(dateMatch[2], 10);
    const jd = parseInt(dateMatch[3], 10);

    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);

    // See if there's a time part (e.g. 08:30)
    let startHour = '08';
    let startMin = '00';
    let endHour = '10';
    let endMin = '00';

    const timeMatch = course.examDate.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      startHour = pad(parseInt(timeMatch[1], 10));
      startMin = pad(parseInt(timeMatch[2], 10));
      // Assume 2 hour exam
      endHour = pad((parseInt(startHour, 10) + 2) % 24);
      endMin = startMin;
    }

    const dtStart = `${gy}${pad(gm)}${pad(gd)}T${startHour}${startMin}00`;
    const dtEnd = `${gy}${pad(gm)}${pad(gd)}T${endHour}${endMin}00`;
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const uid = `${course.offeringId || course.courseId}-${dtStart}@darschyn.local`;

    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${uid}\r\n`;
    ics += `DTSTAMP:${dtStamp}\r\n`;
    ics += `DTSTART;TZID=Asia/Tehran:${dtStart}\r\n`;
    ics += `DTEND;TZID=Asia/Tehran:${dtEnd}\r\n`;
    ics += `SUMMARY:امتحان ${course.courseName}\r\n`;
    ics += `DESCRIPTION:تاریخ امتحان: ${course.examDate} - استاد: ${course.instructor || 'نامشخص'}\r\n`;
    ics += 'END:VEVENT\r\n';
  }

  ics += 'END:VCALENDAR\r\n';
  return ics;
}

export function downloadICSFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
