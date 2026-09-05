const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(
  "    const effectiveMinUnits = isSummer ? settings.summerMinUnits : settings.normalMinUnits;",
  "    let effectiveMinUnits = isSummer ? settings.summerMinUnits : settings.normalMinUnits;\n    if (isFinalSemester && !isSummer) effectiveMinUnits = 2;" // IAU minimum final semester
);
fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed DB limits');
