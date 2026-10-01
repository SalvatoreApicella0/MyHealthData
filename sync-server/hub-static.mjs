import fs from 'node:fs/promises';
import path from 'node:path';
import { HubError } from './hub-store.mjs';
import { json, webSecurityHeaders } from './hub-http.mjs';

export const contentTypeFor = (file) => {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js' || extension === '.mjs') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.json' || extension === '.webmanifest') return 'application/manifest+json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
};

/** Serves the optional Web bundle without allowing traversal outside its root. */
export async function serveWeb(response, webDirectory, pathname) {
  if (pathname.includes('\0')) throw new HubError(400, 'invalid_path');
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const root = path.resolve(webDirectory);
  const resolved = path.resolve(root, requested);
  // Separator-aware containment: a sibling directory such as
  // `/app/dist-backup` must not satisfy a naive prefix check.
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new HubError(400, 'invalid_path');

  // Single-page-app routing: try the requested asset, then fall back to the shell.
  const candidates = resolved === root ? [path.join(root, 'index.html')] : [resolved, path.join(root, 'index.html')];

  for (const candidate of candidates) {
    let body;
    try { body = await fs.readFile(candidate); }
    catch (error) { if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) continue; throw error; }
    const extension = path.extname(candidate).toLowerCase();
    response.writeHead(200, {
      'content-type': contentTypeFor(candidate),
      'cache-control': path.basename(candidate) === 'sw.js' ? 'no-cache, no-store, must-revalidate' : extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      ...webSecurityHeaders
    });
    return response.end(body);
  }

  // No built Web bundle in this deployment: answer cleanly instead of hanging.
  return json(response, 404, { error: 'web_bundle_not_found' });
}
