const fs = require('fs');
const path = require('path');
const uiPath = path.join(process.cwd(), 'src/components/AdminDashboard.tsx');

let content = fs.readFileSync(uiPath, 'utf-8');

// Add import
if (!content.includes('AdminImportCenter')) {
  content = content.replace(
    "import { AdminAcademicRules } from './AdminAcademicRules';",
    "import { AdminAcademicRules } from './AdminAcademicRules';\nimport { AdminImportCenter } from './AdminImportCenter';"
  );
}

// Add FileDown icon
if (!content.includes('FileDown')) {
  content = content.replace(
    "FileSpreadsheet,",
    "FileSpreadsheet, FileDown,"
  );
}

// Add tab to structure
const tabsSection = "        { id: 'academic-settings' as AdminTab, label: 'آیین‌نامه و سقف واحدها', icon: SlidersHorizontal }";
if (content.includes(tabsSection)) {
  content = content.replace(
    tabsSection,
    tabsSection + " ] : []),\n        { id: 'imports' as AdminTab, label: 'پایش داده‌های ورودی', icon: FileDown }"
  );
} else {
    // try another spot
    content = content.replace(
        "        { id: 'offerings' as AdminTab, label: 'ارائه‌های ترمی', icon: Layers },",
        "        { id: 'offerings' as AdminTab, label: 'ارائه‌های ترمی', icon: Layers },\n        { id: 'imports' as AdminTab, label: 'پایش داده‌های ورودی', icon: FileDown },"
    );
}

// Add renderer
const rendererSection = "{activeTab === 'offerings' && (";
if (content.includes(rendererSection)) {
  content = content.replace(
    rendererSection,
    "{activeTab === 'imports' && <AdminImportCenter />}\n\n        " + rendererSection
  );
}

fs.writeFileSync(uiPath, content, 'utf-8');
console.log('Dashboard updated.');
