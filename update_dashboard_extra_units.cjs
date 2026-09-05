const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/AdminDashboard.tsx');
let content = fs.readFileSync(p, 'utf-8');

const targetStr = "{ label: 'اختیاری', value: 'اختیاری' },\n                ],\n              },";
const replacementStr = "{ label: 'اختیاری', value: 'اختیاری' },\n                ],\n              },\n              { key: 'isExtraUnit', label: 'مازاد بر واحد (آزاد)', type: 'boolean' },";

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(p, content, 'utf-8');
console.log('Updated AdminDashboard courses columns');
