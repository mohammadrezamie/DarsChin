const fs = require('fs');
const path = require('path');

// Update CourseEligibilityResult interface
const typePath = path.join(process.cwd(), 'src/types/index.ts');
let typeContent = fs.readFileSync(typePath, 'utf-8');
if (!typeContent.includes('  isExtraUnit?: boolean; // Added for UI')) {
    typeContent = typeContent.replace(
        "  units: number;",
        "  units: number;\n  isExtraUnit?: boolean; // Added for UI"
    );
    fs.writeFileSync(typePath, typeContent, 'utf-8');
}

// Update Engine
const enginePath = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let engineContent = fs.readFileSync(enginePath, 'utf-8');
engineContent = engineContent.replace(
    "units: course.units,",
    "units: course.units,\n      isExtraUnit: course.isExtraUnit,"
);
fs.writeFileSync(enginePath, engineContent, 'utf-8');

// Update Planner
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
plannerContent = plannerContent.replace(
    "const isExtra = item.courseName.includes('وصایا') || item.courseName.includes('انس');",
    "const isExtra = item.isExtraUnit;"
);

// We need an extraUnits count to show in UI as requested by prompt:
// "Normal selected units: 18, Extra-unit courses: 2, Effective academic load: 18"
plannerContent = plannerContent.replace(
    "const totalUnits = selectedOfferings.reduce((sum, item) => {",
    "const extraUnits = selectedOfferings.reduce((sum, item) => item.isExtraUnit ? sum + (item.units || 0) : sum, 0);\n  const totalUnits = selectedOfferings.reduce((sum, item) => {"
);

// We should also find where the display for units is and add extra units info.
const unitsDisplayTarget = '<span className={`text-xl font-black ${unitsStatusColor}`}>{totalUnits}</span>';
plannerContent = plannerContent.replace(
    unitsDisplayTarget,
    unitsDisplayTarget + "\n                <div className=\"text-xs text-slate-500 mt-1\">{extraUnits > 0 ? `+ ${extraUnits} مازاد` : ''}</div>"
);

fs.writeFileSync(plannerPath, plannerContent, 'utf-8');
console.log('Fixed extra units planner');
