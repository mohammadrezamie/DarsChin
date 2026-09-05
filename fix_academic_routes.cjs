const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server/routes/academic.ts');
let content = fs.readFileSync(p, 'utf-8');

// POST Course
content = content.replace(
  "const { code, name, units, practicalUnits = 0, category, description, active = true } = req.body;",
  "const { code, name, units, practicalUnits = 0, category, description, active = true, isExtraUnit } = req.body;"
).replace(
  "active: !!active,",
  "active: !!active,\n    isExtraUnit: !!isExtraUnit,"
);

// PUT Course
content = content.replace(
  "const { code, name, units, practicalUnits, category, description, active } = req.body;",
  "const { code, name, units, practicalUnits, category, description, active, isExtraUnit } = req.body;"
).replace(
  "if (typeof active === 'boolean') db.courses[idx].active = active;",
  "if (typeof active === 'boolean') db.courses[idx].active = active;\n  if (typeof isExtraUnit === 'boolean') db.courses[idx].isExtraUnit = isExtraUnit;"
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed academic routes');
