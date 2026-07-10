/* 富厚堂 · 本地静态服务器(零依赖)
   用法: node server.js [端口]   默认 8000 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = +(process.argv[2] || 8000);
const ROOT = path.join(__dirname, 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) for (const n of list) {
    if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  }
  console.log('════════════════════════════════════════');
  console.log('  富厚堂 · 本地服务已启动');
  console.log(`  本机预览:  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  手机访问:  http://${ip}:${PORT}   (同一 Wi-Fi)`));
  console.log('════════════════════════════════════════');
});
