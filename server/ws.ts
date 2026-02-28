import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { extractToken, checkAuth } from './auth.js';
import { collectSubAgents } from './collectors/subAgents.js';
import { collectCodingAgents } from './collectors/codingAgents.js';
import { collectCronJobs } from './collectors/cronJobs.js';
import { collectSystemCron } from './collectors/systemCron.js';
import { collectSysStats } from './collectors/sysStats.js';
import { getCodexSessions, subscribeCodex } from './codexWatcher.js';
import { collectOpenClawAgents } from './collectors/openclawAgents.js';
import type { WsMessage } from './types.js';
import {
  POLL_AGENTS, POLL_CODING, POLL_STATS, POLL_CRON, POLL_SYSCRON,
} from './utils/config.js';

function send(ws: WebSocket, msg: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachWss(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? '';
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : null;
    const token = extractToken(
      req.headers as Record<string, string | string[] | undefined>,
      query,
    );

    if (!checkAuth(token)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Initial burst — send everything immediately on connect
    send(ws, { type: 'agents',         data: collectSubAgents(true) });
    send(ws, { type: 'coding',         data: collectCodingAgents() });
    send(ws, { type: 'stats',          data: collectSysStats() });
    send(ws, { type: 'cron',           data: collectCronJobs().jobs });
    send(ws, { type: 'syscron',        data: collectSystemCron().jobs });
    send(ws, { type: 'codex',          data: getCodexSessions() });
    send(ws, { type: 'openclawAgents', data: collectOpenClawAgents() });

    // Codex: event-driven via fs.watch — push on every file change
    const unsubCodex = subscribeCodex(sessions => send(ws, { type: 'codex', data: sessions }));

    // Ongoing intervals for the other data sources
    const timers = [
      setInterval(() => send(ws, { type: 'agents',         data: collectSubAgents(true) }),         POLL_AGENTS),
      setInterval(() => send(ws, { type: 'coding',         data: collectCodingAgents() }),          POLL_CODING),
      setInterval(() => send(ws, { type: 'stats',          data: collectSysStats() }),              POLL_STATS),
      setInterval(() => send(ws, { type: 'cron',           data: collectCronJobs().jobs }),         POLL_CRON),
      setInterval(() => send(ws, { type: 'syscron',        data: collectSystemCron().jobs }),       POLL_SYSCRON),
      setInterval(() => send(ws, { type: 'openclawAgents', data: collectOpenClawAgents() }),        POLL_CRON),
    ];

    ws.on('close', () => { timers.forEach(clearInterval); unsubCodex(); });
    ws.on('error', () => {
      timers.forEach(clearInterval);
      ws.close();
    });
  });

  return wss;
}
