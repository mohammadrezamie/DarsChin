const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');

const targetTracksStr = `  const targetTrackIds: string[] = isTrackOfficiallySelected
    ? [studentProfile.selectedTrackId!]
    : studentProfile.desiredTrackIds && studentProfile.desiredTrackIds.length > 0
    ? studentProfile.desiredTrackIds
    : tracks.filter((t) => t.majorId === studentProfile.majorId).map((t) => t.id);`;

const newTracksStr = `  let targetTrackIds: string[] = isTrackOfficiallySelected
    ? [studentProfile.selectedTrackId!]
    : studentProfile.desiredTrackIds && studentProfile.desiredTrackIds.length > 0
    ? studentProfile.desiredTrackIds
    : tracks.filter((t) => t.majorId === studentProfile.majorId).map((t) => t.id);
  
  if (targetTrackIds.length === 0) {
    targetTrackIds = ['generic'];
  }`;

content = content.replace(targetTracksStr, newTracksStr);
fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed engine generic track');
