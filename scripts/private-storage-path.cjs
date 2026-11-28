'use strict';
// نام‌های بکاپ، کلید و دیتابیس خارج از مسیرهای عمومی مجاز نیستند.
function isPrivateStoragePath(file) {
  const name=file.replace(/\\/g,'/');
  return /\.(?:pem|p12|pfx|jks|keystore|dcb|key|backup|bak|dump|sqlite3?|db)$/i.test(name) ||
    /(^|\/)(?:id_rsa|id_ed25519|credentials\.json|service-account(?:-.*)?\.json|secrets\.json|darschyn-db\.json(?:\.[^/]+)?)$/i.test(name) ||
    /(^|\/)data\/.*\.(?:json|jsonl|sqlite3?|db|csv|xlsx?|log|bak)$/i.test(name);
}
module.exports={isPrivateStoragePath};
