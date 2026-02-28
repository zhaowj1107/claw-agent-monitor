import * as http from 'http';
import { extractToken, checkAuth } from './auth.js';
import { buildSnapshot } from './snapshot.js';
import { attachWss } from './ws.js';

const PORT = parseInt(process.env.PORT ?? '4242', 10);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // CORS headers for web frontend dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: '1.0.0' }));
    return;
  }

  if (url.pathname === '/api/snapshot') {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const token = extractToken(headers, url.search || null);
    if (!checkAuth(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(buildSnapshot()));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

attachWss(server);

server.listen(PORT, () => {
  const hasToken = !!process.env.CLAW_TOKEN;
  console.log(`Claw-AgentMonitor server running on http://localhost:${PORT}`);
  console.log(`Auth: ${hasToken ? 'token required (CLAW_TOKEN is set)' : 'no-auth mode (localhost only)'}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
