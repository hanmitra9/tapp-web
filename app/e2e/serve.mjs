// Serves the combined build (repo-root dist/, from site/tools/build_all.py) with the production rules:
// existing file → it; /x → x.html (clean URLs); /admin/* → admin SPA; anything else → app.html (signed-in pages).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT ?? 4173);
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(root, path), join(root, path, 'index.html'), join(root, path + '.html')];
  let file = null;
  for (const c of candidates) if (await isFile(c)) { file = c; break; }
  if (!file) file = path.startsWith('/admin/') ? join(root, 'admin/index.html') : join(root, 'app.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, () => console.log(`serving dist on :${port}`));
