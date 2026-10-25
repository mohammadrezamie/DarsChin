const fs = require('fs');
let js = fs.readFileSync('extension/content.js', 'utf8');

js = js.replace(/\\/g, '\\\\');
js = js.replace(/`/g, '\\`');
js = js.replace(/\$\{/g, '\\${');

let out = `const fs = require('fs');\nlet content = \`${js}\`;\nfs.writeFileSync('extension/content.js', content);\n`;
fs.writeFileSync('generate_content_js.cjs', out);
