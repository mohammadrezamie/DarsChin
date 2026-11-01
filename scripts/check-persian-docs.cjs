// Prevent official repository guides from silently reverting to English.
// Paths, API/ENV identifiers, Markdown link targets and code fences are not prose.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const folders=['docs','deploy','extension','scripts/legacy','.github'];
const top=['README.md','AGENTS.md','CONTRIBUTING.md','SECURITY.md'];
function enumerate(folder) {
  const absolute=path.join(root,folder);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute,{withFileTypes:true}).flatMap(entry=>{
    if (entry.name==='node_modules'||entry.name==='.git') return [];
    const relative=path.join(folder,entry.name);
    return entry.isDirectory()?enumerate(relative):entry.isFile()&&entry.name.endsWith('.md')?[relative]:[];
  });
}
function readableProse(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/`[^`\n]+`/g,' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/https?:\/\/\S+/g,' ')
    .replace(/<!--([\s\S]*?)-->/g,' ')
    .replace(/\b[A-Z0-9_/-]{5,}\b/g,' ');
}
function checkPersianDocs(markdown) {
  const prose=readableProse(markdown);
  const farsi=(prose.match(/[\u0600-\u06FF]/g)||[]).length;
  const english=(prose.match(/[a-zA-Z]/g)||[]).length;
  return farsi>=25 && english <= farsi*3;
}
const files=[...top,...folders.flatMap(enumerate)];
const failures=files.filter(file=>!checkPersianDocs(fs.readFileSync(path.join(root,file),'utf8')));
if (require.main===module) {
  if(failures.length){
    console.error('مستندات فاقد متن فارسی کافی یا غالباً انگلیسی هستند:\n'+failures.join('\n'));
    process.exitCode=1;
  }else{
    console.log('بررسی فارسی‌بودن '+files.length+' سند رسمی با موفقیت انجام شد.');
  }
}
module.exports={checkPersianDocs,readableProse};
