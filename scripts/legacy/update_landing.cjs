const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/Landing.tsx');
let content = fs.readFileSync(file, 'utf-8');

content = content.replace("<span>شروع رایگان</span>", "<span>دانلود اکستنشن کروم</span>");
content = content.replace("to=\"/register\"", "to=\"#\" onClick={(e) => { e.preventDefault(); alert('لینک دانلود اکستنشن به زودی...'); }}");
content = content.replace("<span>ثبت‌نام و شروع</span>", "<span>دریافت اکستنشن</span>");
// we should probably keep register/login in the header. I will just do the CTA change.

fs.writeFileSync(file, content);
