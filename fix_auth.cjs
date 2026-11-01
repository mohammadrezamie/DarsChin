const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/context/AuthContext.tsx');
let content = fs.readFileSync(file, 'utf-8');

content = content.replace("    if (token) {\n      fetchCurrentUser();\n    } else {\n      // Auto-login with demo student for seamless local testing\n      switchDemoRole('student');\n    }", "    if (token) {\n      fetchCurrentUser();\n    } else {\n      setIsLoading(false);\n    }");

fs.writeFileSync(file, content);
