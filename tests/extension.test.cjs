const fs = require('fs');

console.log("Starting extension unit tests...");

global.window = {};
global.document = { addEventListener: () => {} };

let messageListeners = [];
global.chrome = {
    runtime: {
        onMessage: { addListener: (cb) => { messageListeners.push(cb); } },
        sendMessage: () => {}
    }
};

require('../extension/content.js');

if (messageListeners.length === 0) {
    console.error("FAIL: No message listeners registered");
    process.exit(1);
}

let pongReceived = false;
messageListeners.forEach(cb => cb({ type: 'PING' }, {}, (res) => {
    if (res && res.type === 'PONG') pongReceived = true;
}));

if (!pongReceived) {
    console.error("FAIL: PONG not received");
    process.exit(1);
}

console.log("✓ PING/PONG Handshake works");
console.log("✓ Extension unit tests passed");
