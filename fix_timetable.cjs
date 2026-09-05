const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let content = fs.readFileSync(p, 'utf-8');

// Proper overlap calculation
const overlapLogic = `const matchingOfferings = selectedOfferings.filter((item) => {
                          if (item.dayOfWeek !== day || !item.startTime || !item.endTime) return false;
                          const parseTime = (t) => {
                            const [h, m] = t.split(':').map(Number);
                            return h * 60 + (m || 0);
                          };
                          const itemStart = parseTime(item.startTime);
                          const itemEnd = parseTime(item.endTime);
                          const slotStart = parseTime(slot.start);
                          const slotEnd = parseTime(slot.end);
                          
                          // overlap exists if item starts before slot ends AND item ends after slot starts
                          return itemStart < slotEnd && itemEnd > slotStart;
                        });`;

content = content.replace(
  "const matchingOfferings = selectedOfferings.filter(\n                          (item) => item.dayOfWeek === day && item.startTime?.startsWith(slot.start.slice(0, 2))\n                        );",
  overlapLogic
);

// We need to fix the time slots to be more comprehensive or generic, but for IAU it's generally these 4 slots (08-10, 10-12, 13:30-15:30, 15:30-17:30). If it overlaps, it shows up in that row.
// Let's add an additional time slot for 17:30 - 19:30 to be safe.
const timeSlotsOriginal = `const TIME_SLOTS = [
  { label: '۰۸:۰۰ - ۱۰:۰۰', start: '08:00', end: '10:00' },
  { label: '۱۰:۰۰ - ۱۲:۰۰', start: '10:00', end: '12:00' },
  { label: '۱۳:۳۰ - ۱۵:۳۰', start: '13:30', end: '15:30' },
  { label: '۱۵:۳۰ - ۱۷:۳۰', start: '15:30', end: '17:30' },
];`;
const timeSlotsNew = `const TIME_SLOTS = [
  { label: '۰۷:۳۰ - ۰۹:۳۰', start: '07:30', end: '09:30' },
  { label: '۰۹:۳۰ - ۱۱:۳۰', start: '09:30', end: '11:30' },
  { label: '۱۱:۳۰ - ۱۳:۳۰', start: '11:30', end: '13:30' },
  { label: '۱۳:۳۰ - ۱۵:۳۰', start: '13:30', end: '15:30' },
  { label: '۱۵:۳۰ - ۱۷:۳۰', start: '15:30', end: '17:30' },
  { label: '۱۷:۳۰ - ۱۹:۳۰', start: '17:30', end: '19:30' },
];`;
content = content.replace(timeSlotsOriginal, timeSlotsNew);

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed Timetable Overlaps');
