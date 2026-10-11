'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const root = path.resolve(__dirname, 'site');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.wasm':'application/wasm', '.json':'application/json', '.data':'application/octet-stream', '.tflite':'application/octet-stream', '.binarypb':'application/octet-stream' };
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {Allow:'GET, HEAD'}); response.end(); return;
  }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
  } catch {
    response.writeHead(400); response.end('Invalid request'); return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });
});
let fallback = false;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !fallback) { fallback = true; server.listen(0, '127.0.0.1'); return; }
  console.error('启动失败：', error.message); process.exitCode = 1;
});
server.on('listening', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Fingertip Bloom running at ${url}`);
  console.log('指尖花园已启动。请保持此窗口打开，停止时按 Ctrl+C。');
  if (process.platform === 'darwin') {
    execFile('/usr/bin/open', [url], error => {
      if (error) console.log('请将上方地址复制到浏览器地址栏打开。');
    });
  } else if (process.platform === 'win32') {
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true }, error => {
      if (error) console.log('请将上方地址复制到浏览器地址栏打开。');
    });
  }
});
server.listen(5173, '127.0.0.1');
process.on('SIGINT', () => server.close(() => process.exit(0)));
