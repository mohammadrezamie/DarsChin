const fs = require('fs');
const path = require('path');

const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
plannerContent = `import { Check } from 'lucide-react';\n` + plannerContent;
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

console.log('Fixed Check import');
