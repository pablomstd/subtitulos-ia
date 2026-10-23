import app from '../core.js';

export default async function handler(req, res) {
  try {
    const scheme = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost';
    const orig = req.headers['x-vercel-original-url'] || req.url;
    const path = orig.startsWith('/api/index') ? (orig.slice('/api/index'.length) || '/') : orig;
    const request = new Request(`${scheme}://${host}${path}`, {
      method: req.method,
      headers: req.headers,
    });
    const response = await app.fetch(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error('handler error', err);
    res.writeHead(500);
    res.end('Error interno');
  }
}
