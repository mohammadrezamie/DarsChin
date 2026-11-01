const fs = require('fs');

let content = fs.readFileSync('server/db/database.ts', 'utf8');

const injectionStart = `        const rootMobile = process.env.ROOT_OWNER_MOBILE;`;
const injectionEnd = `            this.save();
        }

        
        if (!this.data.supportTickets) this.data.supportTickets = [];`;

let parts = content.split(injectionStart);
let before = parts[0];
let afterAndInjection = parts[1];

let injectionParts = afterAndInjection.split(`if (!this.data.supportTickets) this.data.supportTickets = [];`);
let injectionLogic = injectionStart + injectionParts[0];
let after = `if (!this.data.supportTickets) this.data.supportTickets = [];` + injectionParts[1];

const catchIndex = after.indexOf(`} catch (err) {`);
const theEndIndex = after.indexOf(`this.isInitialized = true;`, catchIndex);

let newAfter = after.substring(0, theEndIndex) + "\n" + injectionLogic + "\n" + after.substring(theEndIndex);

content = before + newAfter;
fs.writeFileSync('server/db/database.ts', content);
