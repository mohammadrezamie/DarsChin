const { ZipArchive } = require('archiver');
const archive = new ZipArchive({ zlib: { level: 9 } });
console.log(typeof archive.pipe);
