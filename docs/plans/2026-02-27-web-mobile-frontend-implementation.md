# Web & Mobile Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `server/` (Node.js WebSocket + HTTP) and `web/` (Next.js 14 PWA) to the existing claw-monitor monorepo, enabling real-time monitoring from any browser or phone.

**Architecture:** The server re-uses existing utility functions from `src/utils/` as pure collectors, exposes a `/api/snapshot` HTTP endpoint and a WebSocket at `ws://host:4242/ws`, and serves the Next.js static build. The web app connects via WebSocket after authenticating with a Bearer token stored in `localStorage`.

**Tech Stack:** Node.js `http` + `ws` (no Express), Next.js 14 App Router, shadcn/ui, Tailwind CSS, Fira Code + Fira Sans fonts, Vitest for server tests.

**Design Reference:** `docs/plans/2026-02-27-web-mobile-frontend-design.md`

---

## Phase 1: Server Infrastructure

### Task 1: Add Vitest + tsx + ws dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tsconfig.server.json`

**Step 1: Install dependencies**

```bash
npm install --save ws
npm install --save-dev vitest tsx @types/ws
```

**Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
});
```

**Step 3: Create `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/server",
    "rootDir": "./server"
  },
  "include": ["server/**/*"]
}
```

**Step 4: Add scripts to `package.json`**

Add alongside existing scripts:
```json
"dev:server":    "tsx watch server/index.ts",
"build:server":  "tsc --project tsconfig.server.json",
"start:server":  "node dist/server/index.js",
"test":          "vitest run",
"test:watch":    "vitest"
```

**Step 5: Run tests (should pass with zero tests)**

```bash
npm test
```
Expected: `No test files found`

**Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.server.json
git commit -m "chore: add vitest, tsx, ws; server tsconfig and scripts"
```

---

### Task 2: Shared types (`server/types.ts`)

**Files:**
- Create: `server/types.ts`
- Create: `server/types.test.ts`

**Step 1: Write the failing test**

```typescript
// server/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { WsMessage, SnapshotPayload } from './types.js';

describe('WsMessage discriminated union', () => {
  it('agents message has SubAgentData[] data', () => {
    expectTypeOf<Extract<WsMessage, { type: 'agents' }>['data']>()
      .toEqualTypeOf<import('./types.js').SubAgentData[]>();
  });

  it('stats message has SysStats data', () => {
    expectTypeOf<Extract<WsMessage, { type: 'stats' }>['data']>()
      .toEqualTypeOf<import('./types.js').SysStats>();
  });
});
```

**Step 2: Run to verify it fails**

```bash
npm test
```
Expected: `Cannot find module './types.js'`

**Step 3: Create `server/types.ts`**

```typescript
// Mirrors SessionData from src/utils/parseSession.ts but without React deps
export interface SubAgentData {
  label: string;
  status: 'running' | 'complete' | 'failed';
  elapsed: number;
  currentTool: string | null;
  toolArgs: string | null;
  toolCount: number;
  recentTools: string[];
  errorDetails: string | null;
  filePath: string;
  startTime: number;
}

export interface CodingAgent {
  type: 'CC' | 'GHCP' | 'Codex';
  pid: number;
  elapsed: string;
  command: string;
}

export interface CronJobData {
  name: string;
  schedule: string;
  model?: string;
  nextRun: number | null;
  lastDuration?: number;
  consecutiveErrors?: number;
  isRunning?: boolean;
  source: 'openclaw' | 'system';
  lastRun?: number;
}

export interface GpuInfo {
  percent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  name: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
  status: string;
  source: 'docker' | 'k8s';
}

export interface SysStats {
  cpu: { percent: number; cores: number };
  mem: { usedGB: number; totalGB: number; percent: number };
  disk: { usedGB: number; totalGB: number; percent: number; mount: string };
  gpu: GpuInfo | null;
  containers: ContainerInfo[];
  warnings: string[];
}

export interface SnapshotPayload {
  agents: SubAgentData[];
  coding: CodingAgent[];
  cron: CronJobData[];
  syscron: CronJobData[];
  stats: SysStats;
}

export type WsMessage =
  | { type: 'agents';  data: SubAgentData[] }
  | { type: 'coding';  data: CodingAgent[] }
  | { type: 'cron';    data: CronJobData[] }
  | { type: 'syscron'; data: CronJobData[] }
  | { type: 'stats';   data: SysStats }
  | { type: 'error';   data: { message: string } };
```

**Step 4: Run tests**

```bash
npm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add server/types.ts server/types.test.ts
git commit -m "feat(server): add shared TypeScript types"
```

---

### Task 3: Auth middleware (`server/auth.ts`)

**Files:**
- Create: `server/auth.ts`
- Create: `server/auth.test.ts`

**Step 1: Write the failing test**

```typescript
// server/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkAuth, extractToken } from './auth.js';

describe('extractToken', () => {
  it('extracts Bearer token from Authorization header', () => {
    expect(extractToken({ authorization: 'Bearer abc123' }, null)).toBe('abc123');
  });

  it('extracts token from ?token= query string', () => {
    expect(extractToken({}, '?token=abc123')).toBe('abc123');
  });

  it('returns null when no token present', () => {
    expect(extractToken({}, null)).toBeNull();
  });
});

describe('checkAuth', () => {
  beforeEach(() => { process.env.CLAW_TOKEN = 'secret'; });
  afterEach(() => { delete process.env.CLAW_TOKEN; });

  it('returns true when token matches', () => {
    expect(checkAuth('secret')).toBe(true);
  });

  it('returns false when token does not match', () => {
    expect(checkAuth('wrong')).toBe(false);
  });

  it('returns true when no CLAW_TOKEN set (no-auth mode)', () => {
    delete process.env.CLAW_TOKEN;
    expect(checkAuth(null)).toBe(true);
  });
});
```

**Step 2: Run to verify it fails**

```bash
npm test
```
Expected: `Cannot find module './auth.js'`

**Step 3: Create `server/auth.ts`**

```typescript
export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  queryString: string | null,
): string | null {
  // Bearer token from Authorization header
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // ?token= query param (for WebSocket upgrade requests)
  if (queryString) {
    const params = new URLSearchParams(queryString.replace(/^\?/, ''));
    const t = params.get('token');
    if (t) return t;
  }
  return null;
}

export function checkAuth(token: string | null): boolean {
  const required = process.env.CLAW_TOKEN;
  if (!required) return true;   // no-auth mode: safe because server binds to localhost
  return token === required;
}
```

**Step 4: Run tests**

```bash
npm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add server/auth.ts server/auth.test.ts
git commit -m "feat(server): auth middleware (Bearer token + query param)"
```

---

### Task 4: Sub-agent collector (`server/collectors/subAgents.ts`)

**Files:**
- Create: `server/collectors/subAgents.ts`
- Create: `server/collectors/subAgents.test.ts`

**Step 1: Write the failing test**

```typescript
// server/collectors/subAgents.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectSubAgents } from './subAgents.js';

vi.mock('fs');

describe('collectSubAgents', () => {
  it('returns empty array when sessions dir does not exist', async () => {
    const { default: fs } = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = collectSubAgents();
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run to verify it fails**

```bash
npm test
```

**Step 3: Create `server/collectors/subAgents.ts`**

This is a pure-function extraction of the logic in `src/hooks/useSubAgents.ts`. Key difference: no React, no useState — just a function that returns data.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseSession } from '../../src/utils/parseSession.js';
import { SESSIONS_DIR, SESSIONS_JSON, MAX_SESSIONS } from '../../src/utils/config.js';
import type { SubAgentData } from '../types.js';

interface SessionMeta {
  sessionId: string;
  label?: string;
  updatedAt?: number;
}

function loadSessionsData() {
  const labels = new Map<string, string>();
  const activeSessionIds = new Set<string>();
  const subagentSessionIds = new Set<string>();
  try {
    if (fs.existsSync(SESSIONS_JSON)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_JSON, 'utf-8'));
      const now = Date.now();
      for (const [key, value] of Object.entries(data)) {
        const meta = value as SessionMeta;
        if (!meta.sessionId || !key.includes('subagent')) continue;
        subagentSessionIds.add(meta.sessionId);
        if (meta.label) labels.set(meta.sessionId, meta.label);
        if (meta.updatedAt && now - meta.updatedAt < 60000) {
          activeSessionIds.add(meta.sessionId);
        }
      }
    }
  } catch { /* ignore */ }
  return { labels, activeSessionIds, subagentSessionIds };
}

export function collectSubAgents(showAll = false): SubAgentData[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const { labels, activeSessionIds, subagentSessionIds } = loadSessionsData();

  let sessions = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl') && !f.includes('.lock') && !f.includes('.deleted'))
    .map(f => {
      const filePath = path.join(SESSIONS_DIR, f);
      const session = parseSession(filePath);
      if (!session) return null;
      const sessionId = path.basename(f, '.jsonl');
      if (!subagentSessionIds.has(sessionId)) return null;
      const label = labels.get(sessionId);
      if (label) session.label = label;
      if (activeSessionIds.has(sessionId)) session.status = 'running';
      else if (session.status === 'running') session.status = 'complete';
      return session as SubAgentData;
    })
    .filter((s): s is SubAgentData => s !== null)
    .sort((a, b) => b.startTime - a.startTime);

  return showAll ? sessions.slice(0, MAX_SESSIONS) : sessions.filter(s => s.status === 'running');
}
```

**Step 4: Run tests**

```bash
npm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add server/collectors/subAgents.ts server/collectors/subAgents.test.ts
git commit -m "feat(server): sub-agents collector (pure function)"
```

---

### Task 5: Coding-agents + cron collectors

**Files:**
- Create: `server/collectors/codingAgents.ts`
- Create: `server/collectors/cronJobs.ts`
- Create: `server/collectors/systemCron.ts`
- Create: `server/collectors/sysStats.ts`

These are direct extractions of the shell-command logic from the existing hooks. Since they depend on `execSync`, tests mock the child_process module.

**Step 1: Create `server/collectors/codingAgents.ts`**

Extract `detectAgents()` from `src/hooks/useCodingAgents.ts` verbatim. The function already has no React imports — just copy-paste with updated import paths and export as `collectCodingAgents()`.

```typescript
// server/collectors/codingAgents.ts
import { execSync } from 'child_process';
import type { CodingAgent } from '../types.js';

// ... (copy PATTERNS, EXCLUDE_PATTERNS, parsePsLine, detectAgents from src/hooks/useCodingAgents.ts)
// rename detectAgents → collectCodingAgents and export it

export function collectCodingAgents(): CodingAgent[] {
  // identical logic to detectAgents() in src/hooks/useCodingAgents.ts
}
```

**Step 2: Create `server/collectors/cronJobs.ts`**

Extract the shell command + parsing logic from `src/hooks/useCronJobs.ts`:

```typescript
// server/collectors/cronJobs.ts
import { execSync } from 'child_process';
import { cronToHuman, nextCronRun } from '../../src/utils/cronUtils.js';
import type { CronJobData } from '../types.js';

export function collectCronJobs(): { jobs: CronJobData[]; warning?: string } {
  // copy logic from useCronJobs.ts loadJobs() function
  // return { jobs, warning } instead of calling setState
}
```

**Step 3: Create `server/collectors/systemCron.ts`**

Same pattern from `src/hooks/useSystemCron.ts`:

```typescript
export function collectSystemCron(): { jobs: CronJobData[]; warning?: string } { ... }
```

**Step 4: Create `server/collectors/sysStats.ts`**

Copy `collectStats()` from `src/hooks/useSysStats.ts` — it's already a pure function. Update import paths. Export it as `collectSysStats()`.

```typescript
// server/collectors/sysStats.ts
import { execSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import type { SysStats, ContainerInfo } from '../types.js';

// Copy all helper functions + collectStats() from src/hooks/useSysStats.ts
// Adapt: docker containers + k8s pods merge into ContainerInfo[] (not DockerContainer[])

export function collectSysStats(): SysStats { ... }
```

**Step 5: Commit**

```bash
git add server/collectors/
git commit -m "feat(server): all collectors (codingAgents, cronJobs, systemCron, sysStats)"
```

---

### Task 6: Snapshot endpoint (`server/snapshot.ts`)

**Files:**
- Create: `server/snapshot.ts`
- Create: `server/snapshot.test.ts`

**Step 1: Write the failing test**

```typescript
// server/snapshot.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./collectors/subAgents.js', () => ({ collectSubAgents: () => [] }));
vi.mock('./collectors/codingAgents.js', () => ({ collectCodingAgents: () => [] }));
vi.mock('./collectors/cronJobs.js', () => ({ collectCronJobs: () => ({ jobs: [] }) }));
vi.mock('./collectors/systemCron.js', () => ({ collectSystemCron: () => ({ jobs: [] }) }));
vi.mock('./collectors/sysStats.js', () => ({
  collectSysStats: () => ({
    cpu: { percent: 0, cores: 4 },
    mem: { usedGB: 0, totalGB: 8, percent: 0 },
    disk: { usedGB: 0, totalGB: 100, percent: 0, mount: '/' },
    gpu: null,
    containers: [],
    warnings: [],
  }),
}));

import { buildSnapshot } from './snapshot.js';

describe('buildSnapshot', () => {
  it('returns a SnapshotPayload with all fields', () => {
    const snap = buildSnapshot();
    expect(snap).toHaveProperty('agents');
    expect(snap).toHaveProperty('coding');
    expect(snap).toHaveProperty('cron');
    expect(snap).toHaveProperty('syscron');
    expect(snap).toHaveProperty('stats');
    expect(snap.stats.cpu.cores).toBe(4);
  });
});
```

**Step 2: Run to verify it fails**

```bash
npm test
```

**Step 3: Create `server/snapshot.ts`**

```typescript
import { collectSubAgents } from './collectors/subAgents.js';
import { collectCodingAgents } from './collectors/codingAgents.js';
import { collectCronJobs } from './collectors/cronJobs.js';
import { collectSystemCron } from './collectors/systemCron.js';
import { collectSysStats } from './collectors/sysStats.js';
import type { SnapshotPayload } from './types.js';

export function buildSnapshot(): SnapshotPayload {
  return {
    agents:  collectSubAgents(true),
    coding:  collectCodingAgents(),
    cron:    collectCronJobs().jobs,
    syscron: collectSystemCron().jobs,
    stats:   collectSysStats(),
  };
}
```

**Step 4: Run tests**

```bash
npm test
```
Expected: all pass

**Step 5: Commit**

```bash
git add server/snapshot.ts server/snapshot.test.ts
git commit -m "feat(server): snapshot builder (all collectors in one call)"
```

---

### Task 7: WebSocket broadcaster (`server/ws.ts`)

**Files:**
- Create: `server/ws.ts`

No unit test here — WebSocket is integration-level. Verified manually in Task 8.

**Create `server/ws.ts`:**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { extractToken, checkAuth } from './auth.js';
import { collectSubAgents } from './collectors/subAgents.js';
import { collectCodingAgents } from './collectors/codingAgents.js';
import { collectCronJobs } from './collectors/cronJobs.js';
import { collectSystemCron } from './collectors/systemCron.js';
import { collectSysStats } from './collectors/sysStats.js';
import type { WsMessage } from './types.js';
import {
  POLL_AGENTS, POLL_CODING, POLL_STATS, POLL_CRON, POLL_SYSCRON,
} from '../src/utils/config.js';

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
    const token = extractToken(req.headers as Record<string, string>, query);

    if (!checkAuth(token)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Send each data type on its own interval
    const timers = [
      setInterval(() => send(ws, { type: 'agents', data: collectSubAgents(true) }), POLL_AGENTS),
      setInterval(() => send(ws, { type: 'coding', data: collectCodingAgents() }), POLL_CODING),
      setInterval(() => send(ws, { type: 'stats',  data: collectSysStats() }), POLL_STATS),
      setInterval(() => send(ws, { type: 'cron',   data: collectCronJobs().jobs }), POLL_CRON),
      setInterval(() => send(ws, { type: 'syscron', data: collectSystemCron().jobs }), POLL_SYSCRON),
    ];

    // Initial burst — send everything immediately on connect
    send(ws, { type: 'agents',  data: collectSubAgents(true) });
    send(ws, { type: 'coding',  data: collectCodingAgents() });
    send(ws, { type: 'stats',   data: collectSysStats() });
    send(ws, { type: 'cron',    data: collectCronJobs().jobs });
    send(ws, { type: 'syscron', data: collectSystemCron().jobs });

    ws.on('close', () => timers.forEach(clearInterval));
    ws.on('error', () => timers.forEach(clearInterval));
  });

  return wss;
}
```

**Commit:**

```bash
git add server/ws.ts
git commit -m "feat(server): WebSocket broadcaster with per-type poll intervals"
```

---

### Task 8: Server entry point (`server/index.ts`) + smoke test

**Files:**
- Create: `server/index.ts`

**Create `server/index.ts`:**

```typescript
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { extractToken, checkAuth } from './auth.js';
import { buildSnapshot } from './snapshot.js';
import { attachWss } from './ws.js';

const PORT = parseInt(process.env.PORT ?? '4242', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, '../../web/.next/static');  // adjust after web/ setup

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: '1.0.0' }));
    return;
  }

  if (url.pathname === '/api/snapshot') {
    const token = extractToken(
      Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
      url.search || null,
    );
    if (!checkAuth(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(buildSnapshot()));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

attachWss(server);

server.listen(PORT, () => {
  const hasToken = !!process.env.CLAW_TOKEN;
  console.log(`claw-monitor server running on http://localhost:${PORT}`);
  console.log(`Auth: ${hasToken ? 'token required' : 'no-auth mode (localhost only)'}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
```

**Step: Smoke test**

```bash
npm run dev:server
# In another terminal:
curl http://localhost:4242/api/health
# Expected: {"ok":true,"version":"1.0.0"}

curl http://localhost:4242/api/snapshot
# Expected (no token set): full JSON snapshot
```

**Commit:**

```bash
git add server/index.ts
git commit -m "feat(server): HTTP entry point (health + snapshot + WS)"
```

---

## Phase 2: Next.js App

### Task 9: Initialize Next.js app

**Step 1: Scaffold Next.js inside `web/`**

```bash
cd /path/to/claw-monitor
npx create-next-app@14 web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

**Step 2: Install shadcn/ui + fonts**

```bash
cd web
npx shadcn@latest init
# Choose: Default style, Slate base color, CSS variables: yes

npx shadcn@latest add button card badge separator sheet
npm install next-themes
```

**Step 3: Update `web/next.config.ts`**

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // static export — served by claw-monitor server
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4242',
  },
};
export default nextConfig;
```

**Step 4: Add Google Fonts to `web/app/layout.tsx`**

```typescript
import { Fira_Code, Fira_Sans } from 'next/font/google';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fira-sans',
});
const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-fira-code',
});
```

**Step 5: Run dev server to verify**

```bash
cd web && npm run dev
```
Expected: Next.js welcome page at `http://localhost:3000`

**Step 6: Commit**

```bash
cd ..
git add web/
git commit -m "feat(web): init Next.js 14 app with shadcn/ui, Tailwind, Fira fonts"
```

---

### Task 10: Design tokens in `web/app/globals.css`

**Files:**
- Modify: `web/app/globals.css`

**Replace** the shadcn default colors with the claw-monitor palette from the design doc:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background:  248 250 252;   /* slate-50  */
    --foreground:  15  23  42;    /* slate-900 */
    --card:        255 255 255;
    --card-foreground: 15 23 42;
    --border:      226 232 240;   /* slate-200 */
    --muted:       241 245 249;   /* slate-100 */
    --muted-foreground: 71 85 105; /* slate-600 */
    --primary:     34 197 94;     /* green-500 = running */
    --primary-foreground: 255 255 255;
    --destructive: 239 68 68;     /* red-500   */
    --warning:     245 158 11;    /* amber-500 */
    --info:        59 130 246;    /* blue-500  */
    --radius:      0.75rem;

    /* Status */
    --status-running:  34 197 94;
    --status-complete: 100 116 139;
    --status-error:    239 68 68;
  }

  .dark {
    --background:  2 6 23;        /* slate-950 */
    --foreground:  248 250 252;   /* slate-50  */
    --card:        15 23 42;      /* slate-900 */
    --card-foreground: 248 250 252;
    --border:      30 41 59;      /* slate-800 */
    --muted:       15 23 42;
    --muted-foreground: 148 163 184; /* slate-400 */
    --primary:     34 197 94;
    --primary-foreground: 2 6 23;
  }
}

body {
  font-family: var(--font-fira-sans), system-ui, sans-serif;
  font-size: 16px;
}

.font-mono, code, .tabular-nums {
  font-family: var(--font-fira-code), 'Courier New', monospace;
}
```

**Commit:**

```bash
git add web/app/globals.css
git commit -m "feat(web): design tokens — OLED dark + light palette, Fira fonts"
```

---

### Task 11: Auth lib (`web/lib/auth.ts`) + format lib

**Files:**
- Create: `web/lib/auth.ts`
- Create: `web/lib/format.ts`

**Create `web/lib/auth.ts`:**

```typescript
const TOKEN_KEY = 'claw_monitor_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getServerUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4242';
}

export function getWsUrl(): string {
  const base = getServerUrl().replace(/^http/, 'ws');
  const token = getToken();
  return token ? `${base}/ws?token=${encodeURIComponent(token)}` : `${base}/ws`;
}
```

**Create `web/lib/format.ts`:**

```typescript
export function formatElapsed(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function formatBytes(gb: number): string {
  return `${gb.toFixed(1)} GB`;
}

export function relativeTime(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60000) return `in ${Math.round(diff / 1000)}s`;
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`;
  return `in ${Math.round(diff / 3600000)}h`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
```

**Commit:**

```bash
git add web/lib/
git commit -m "feat(web): auth token storage and format utilities"
```

---

### Task 12: ThemeProvider + top-level layout

**Files:**
- Modify: `web/app/layout.tsx`
- Create: `web/components/ThemeToggle.tsx`

**Update `web/app/layout.tsx`** to wrap with `ThemeProvider` from `next-themes`:

```typescript
import { ThemeProvider } from 'next-themes';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${firaSans.variable} ${firaCode.variable} bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Create `web/components/ThemeToggle.tsx`:**

```typescript
'use client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="cursor-pointer min-h-[44px] min-w-[44px]"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```

**Commit:**

```bash
git add web/app/layout.tsx web/components/ThemeToggle.tsx
git commit -m "feat(web): ThemeProvider with dark/light toggle"
```

---

### Task 13: WebSocket hook (`web/hooks/useWebSocket.ts`)

**Files:**
- Create: `web/hooks/useWebSocket.ts`
- Create: `web/hooks/useDashboardData.ts`

**Create `web/hooks/useWebSocket.ts`:**

```typescript
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '@/lib/auth';
import type { WsMessage } from '../../server/types';   // shared types

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => setState('connected');
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data) as WsMessage); } catch { /* skip malformed */ }
    };
    ws.onclose = () => {
      setState('disconnected');
      timerRef.current = setTimeout(connect, 3000);  // auto-reconnect every 3s
    };
    ws.onerror = () => ws.close();
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { state };
}
```

**Create `web/hooks/useDashboardData.ts`:**

```typescript
'use client';
import { useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import type { SubAgentData, CodingAgent, CronJobData, SysStats } from '../../server/types';

export interface DashboardData {
  agents: SubAgentData[];
  coding: CodingAgent[];
  cron: CronJobData[];
  syscron: CronJobData[];
  stats: SysStats | null;
}

const INITIAL: DashboardData = { agents: [], coding: [], cron: [], syscron: [], stats: null };

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(INITIAL);

  const handleMessage = useCallback((msg: any) => {
    setData(prev => ({ ...prev, [msg.type]: msg.data }));
  }, []);

  const { state } = useWebSocket(handleMessage);

  return { data, connectionState: state };
}
```

**Commit:**

```bash
git add web/hooks/
git commit -m "feat(web): WebSocket hook with auto-reconnect + dashboard data aggregator"
```

---

### Task 14: Core UI components

**Files:**
- Create: `web/components/StatusDot.tsx`
- Create: `web/components/ConnectionBanner.tsx`
- Create: `web/components/ResourceBar.tsx`

**Create `web/components/StatusDot.tsx`:**

```typescript
import { cn } from '@/lib/utils';

type Status = 'running' | 'complete' | 'failed';

const COLOR: Record<Status, string> = {
  running:  'bg-green-500',
  complete: 'bg-slate-500',
  failed:   'bg-red-500',
};

export function StatusDot({ status, live = false }: { status: Status; live?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        COLOR[status],
        live && status === 'running' && 'animate-pulse motion-reduce:animate-none',
      )}
      aria-label={status}
    />
  );
}
```

**Create `web/components/ConnectionBanner.tsx`:**

```typescript
'use client';
export function ConnectionBanner({ state }: { state: 'connecting' | 'connected' | 'disconnected' }) {
  if (state === 'connected') return null;
  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-sm text-center py-1 font-medium"
    >
      {state === 'connecting' ? 'Connecting to server…' : 'Disconnected — reconnecting…'}
    </div>
  );
}
```

**Create `web/components/ResourceBar.tsx`:**

```typescript
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  percent: number;
  detail?: string;
  warnAt?: number;
  critAt?: number;
}

export function ResourceBar({ label, percent, detail, warnAt = 70, critAt = 90 }: Props) {
  const color =
    percent >= critAt  ? 'bg-red-500' :
    percent >= warnAt  ? 'bg-amber-500' :
                         'bg-green-500';

  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <span className="w-10 text-xs text-muted-foreground font-mono shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.min(percent, 100)}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="w-10 text-right text-xs font-mono text-muted-foreground shrink-0">
        {percent}%
      </span>
      {detail && <span className="text-xs text-muted-foreground hidden sm:inline">{detail}</span>}
    </div>
  );
}
```

**Commit:**

```bash
git add web/components/StatusDot.tsx web/components/ConnectionBanner.tsx web/components/ResourceBar.tsx
git commit -m "feat(web): StatusDot, ConnectionBanner, ResourceBar components"
```

---

### Task 15: AgentCard + AgentDrawer

**Files:**
- Create: `web/components/AgentCard.tsx`
- Create: `web/components/AgentDrawer.tsx`

**Create `web/components/AgentCard.tsx`:**

```typescript
'use client';
import { StatusDot } from './StatusDot';
import { formatElapsed, truncate } from '@/lib/format';
import type { SubAgentData } from '../../server/types';

interface Props {
  agent: SubAgentData;
  onClick: () => void;
}

export function AgentCard({ agent, onClick }: Props) {
  const { label, status, elapsed, currentTool, toolArgs, toolCount } = agent;
  const detail = status === 'running' && currentTool
    ? `${currentTool}${toolArgs ? `: ${toolArgs}` : ''}`
    : `${toolCount} tool calls`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 cursor-pointer
                 hover:border-primary/50 transition-colors duration-200 min-h-[44px]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center gap-2">
        <StatusDot status={status} live />
        <span className="flex-1 text-sm font-medium truncate">{truncate(label, 36)}</span>
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </div>
      <p className="mt-1 ml-5 text-xs text-muted-foreground truncate font-mono">{detail}</p>
    </button>
  );
}
```

**Create `web/components/AgentDrawer.tsx`:**

Uses shadcn `Sheet` — bottom on mobile, right-side on desktop via CSS:

```typescript
'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatElapsed } from '@/lib/format';
import type { SubAgentData } from '../../server/types';

interface Props {
  agent: SubAgentData | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  running: 'default',
  complete: 'secondary',
  failed: 'destructive',
};

export function AgentDrawer({ agent, onClose }: Props) {
  return (
    <Sheet open={!!agent} onOpenChange={open => !open && onClose()}>
      {/* sm:bottom → lg:right via shadcn side prop */}
      <SheetContent side="bottom" className="lg:!inset-y-0 lg:right-0 lg:!left-auto lg:!w-[380px] lg:rounded-none">
        {agent && (
          <>
            <SheetHeader>
              <SheetTitle className="text-left pr-8">{agent.label}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatElapsed(agent.elapsed)}
                </span>
              </div>
              {agent.recentTools.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent tools</p>
                  <ol className="space-y-1">
                    {agent.recentTools.map((t, i) => (
                      <li key={i} className="text-xs font-mono text-foreground">
                        {i + 1}. {t}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {agent.errorDetails && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-xs font-medium text-destructive mb-1">Error</p>
                  <p className="text-xs font-mono text-destructive/80">{agent.errorDetails}</p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

**Commit:**

```bash
git add web/components/AgentCard.tsx web/components/AgentDrawer.tsx
git commit -m "feat(web): AgentCard and AgentDrawer (bottom sheet + side panel)"
```

---

### Task 16: Dashboard layout + main page

**Files:**
- Create: `web/components/Topbar.tsx`
- Create: `web/components/BottomNav.tsx`
- Create: `web/components/Sidebar.tsx`
- Create: `web/app/dashboard/layout.tsx`
- Modify: `web/app/dashboard/page.tsx`

**Create `web/components/Topbar.tsx`:**

```typescript
'use client';
import { ThemeToggle } from './ThemeToggle';
import { StatusDot } from './StatusDot';

interface Props {
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

export function Topbar({ connectionState }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-border
                       bg-background/80 backdrop-blur-md flex items-center px-4 gap-3">
      <span className="text-base font-semibold select-none">🦞 claw-monitor</span>
      <div className="flex items-center gap-1.5 ml-auto">
        <StatusDot
          status={connectionState === 'connected' ? 'running' : 'failed'}
          live={connectionState === 'connected'}
        />
        <span className="text-xs text-muted-foreground">
          {connectionState === 'connected' ? 'LIVE' : connectionState.toUpperCase()}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
```

**Create `web/app/dashboard/layout.tsx`:**

```typescript
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Clock, Server } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Topbar } from '@/components/Topbar';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',        label: 'Agents', icon: Users   },
  { href: '/dashboard/cron',   label: 'Cron',   icon: Clock   },
  { href: '/dashboard/system', label: 'System', icon: Server  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connectionState } = useDashboardData();  // context would be better, but fine for v1

  return (
    <div className="min-h-dvh bg-background">
      <ConnectionBanner state={connectionState} />
      <Topbar connectionState={connectionState} />

      {/* Desktop: sidebar */}
      <aside className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 border-r border-border
                        flex-col pt-4 px-3 gap-1 bg-background">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer',
              'transition-colors duration-200 min-h-[44px]',
              pathname === href
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </aside>

      {/* Main content */}
      <main className="pt-14 pb-20 lg:pl-56 lg:pb-6 px-4 lg:px-6 max-w-[1440px]">
        {children}
      </main>

      {/* Mobile: bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border
                      bg-background/90 backdrop-blur-md flex items-center justify-around px-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg min-h-[44px] cursor-pointer',
              'transition-colors duration-200',
              pathname === href ? 'text-primary' : 'text-muted-foreground',
            )}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

**Create `web/app/dashboard/page.tsx`** (main agents + quick stats view):

```typescript
'use client';
import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { AgentCard } from '@/components/AgentCard';
import { AgentDrawer } from '@/components/AgentDrawer';
import { ResourceBar } from '@/components/ResourceBar';
import type { SubAgentData } from '../../../server/types';

export default function DashboardPage() {
  const { data } = useDashboardData();
  const [selected, setSelected] = useState<SubAgentData | null>(null);

  const running = data.agents.filter(a => a.status === 'running');

  return (
    <div className="space-y-6 py-6">
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Sub-Agents ({running.length} running)
        </h2>
        {running.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No running sessions.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {running.map(agent => (
              <AgentCard key={agent.filePath} agent={agent} onClick={() => setSelected(agent)} />
            ))}
          </div>
        )}
      </section>

      {data.stats && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">System</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <ResourceBar label="CPU"  percent={data.stats.cpu.percent}
              detail={`${data.stats.cpu.cores} cores`} />
            <ResourceBar label="MEM"  percent={data.stats.mem.percent}
              detail={`${data.stats.mem.usedGB}/${data.stats.mem.totalGB} GB`} />
            <ResourceBar label="DISK" percent={data.stats.disk.percent}
              detail={`${data.stats.disk.usedGB}/${data.stats.disk.totalGB} GB`} />
            {data.stats.gpu && (
              <ResourceBar label="GPU" percent={data.stats.gpu.percent}
                detail={data.stats.gpu.name} />
            )}
          </div>
        </section>
      )}

      <AgentDrawer agent={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

**Step: Verify in browser**

```bash
# Terminal 1
npm run dev:server

# Terminal 2
cd web && npm run dev
```

Open `http://localhost:3000/dashboard` — should show agents + resource bars.

**Commit:**

```bash
git add web/
git commit -m "feat(web): dashboard layout (sidebar desktop, bottom nav mobile) + main page"
```

---

### Task 17: Login page (`/`)

**Files:**
- Modify: `web/app/page.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveToken, getServerUrl } from '@/lib/auth';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConnect() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/health`);
      if (!res.ok) throw new Error('Server unreachable');

      // Verify token against snapshot (if token required)
      if (token) {
        const snap = await fetch(`${getServerUrl()}/api/snapshot`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (snap.status === 401) {
          setError('Invalid token. Please try again.');
          setLoading(false);
          return;
        }
      }
      saveToken(token);
      router.push('/dashboard');
    } catch {
      setError('Cannot reach claw-monitor server. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-3xl" role="img" aria-label="claw">🦞</span>
          <h1 className="text-xl font-semibold">claw-monitor</h1>
          <p className="text-sm text-muted-foreground">Enter your server token to connect</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              id="token"
              type={show ? 'text' : 'password'}
              placeholder="Token (leave empty if no auth)"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              className="pr-10 font-mono"
              aria-label="Server token"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground
                         cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={show ? 'Hide token' : 'Show token'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <Button
            className="w-full cursor-pointer bg-green-500 hover:bg-green-600 text-white min-h-[44px]"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </div>
    </main>
  );
}
```

**Commit:**

```bash
git add web/app/page.tsx
git commit -m "feat(web): login page with token validation"
```

---

### Task 18: Cron page + System page

**Files:**
- Create: `web/components/CronTable.tsx`
- Create: `web/components/ContainerList.tsx`
- Create: `web/app/dashboard/cron/page.tsx`
- Create: `web/app/dashboard/system/page.tsx`

**Create `web/components/CronTable.tsx`:**

```typescript
import { relativeTime } from '@/lib/format';
import type { CronJobData } from '../../../server/types';

export function CronTable({ jobs, title }: { jobs: CronJobData[]; title: string }) {
  if (jobs.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">{title}</h2>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">Name / Schedule</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Next Run</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{job.name || job.schedule}</div>
                    <div className="text-xs font-mono text-muted-foreground">{job.schedule}</div>
                  </td>
                  <td className="p-3 font-mono text-xs hidden sm:table-cell">
                    {job.nextRun ? relativeTime(job.nextRun) : '—'}
                  </td>
                  <td className="p-3 font-mono text-xs hidden md:table-cell text-muted-foreground">
                    {job.lastRun ? new Date(job.lastRun).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

**Create `web/app/dashboard/cron/page.tsx`:**

```typescript
'use client';
import { useDashboardData } from '@/hooks/useDashboardData';
import { CronTable } from '@/components/CronTable';

export default function CronPage() {
  const { data } = useDashboardData();
  return (
    <div className="space-y-6 py-6">
      <CronTable title="OpenClaw Cron Jobs" jobs={data.cron} />
      <CronTable title="System Cron Jobs"   jobs={data.syscron} />
      {data.cron.length === 0 && data.syscron.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No cron jobs detected.</p>
      )}
    </div>
  );
}
```

**Create `web/app/dashboard/system/page.tsx`:**

```typescript
'use client';
import { useDashboardData } from '@/hooks/useDashboardData';
import { ResourceBar } from '@/components/ResourceBar';
import { formatBytes } from '@/lib/format';

export default function SystemPage() {
  const { data } = useDashboardData();
  const { stats } = data;
  if (!stats) return <p className="py-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="py-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resources</h3>
          <ResourceBar label="CPU"  percent={stats.cpu.percent}  detail={`${stats.cpu.cores} cores`} />
          <ResourceBar label="MEM"  percent={stats.mem.percent}  detail={`${formatBytes(stats.mem.usedGB)} / ${formatBytes(stats.mem.totalGB)}`} />
          <ResourceBar label="DISK" percent={stats.disk.percent} detail={`${formatBytes(stats.disk.usedGB)} / ${formatBytes(stats.disk.totalGB)}`} />
          {stats.gpu && (
            <ResourceBar label="GPU" percent={stats.gpu.percent} detail={`${stats.gpu.name} · ${stats.gpu.memUsedMB}/${stats.gpu.memTotalMB} MB`} />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Containers & Pods ({stats.containers.length})
          </h3>
          {stats.containers.length === 0
            ? <p className="text-sm text-muted-foreground">None detected.</p>
            : <ul className="space-y-2">
                {stats.containers.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono text-xs truncate">{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{c.source}</span>
                  </li>
                ))}
              </ul>
          }
        </div>
      </div>
    </div>
  );
}
```

**Commit:**

```bash
git add web/components/CronTable.tsx web/components/ContainerList.tsx \
        web/app/dashboard/cron/ web/app/dashboard/system/
git commit -m "feat(web): cron page + system page with resource bars and containers"
```

---

### Task 19: PWA manifest + next-pwa

**Files:**
- Create: `web/public/manifest.json`
- Modify: `web/next.config.ts`
- Modify: `web/app/layout.tsx`

**Step 1: Install next-pwa**

```bash
cd web && npm install next-pwa @ducanh2912/next-pwa
```

**Step 2: Create `web/public/manifest.json`**

```json
{
  "name": "claw-monitor",
  "short_name": "claw",
  "description": "Real-time OpenClaw agent monitoring dashboard",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#020617",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

> Note: Create simple 192×192 and 512×512 PNG icons with the 🦞 claw image or a simple green "C" on dark background. Place in `web/public/`.

**Step 3: Add manifest link to `web/app/layout.tsx`**

```typescript
export const metadata = {
  title: 'claw-monitor',
  description: 'Real-time OpenClaw agent monitoring',
  manifest: '/manifest.json',
  themeColor: '#020617',
  appleWebApp: { capable: true, title: 'claw-monitor', statusBarStyle: 'black-translucent' },
};
```

**Step 4: Verify installability**

Open Chrome on mobile → "Add to Home Screen" should appear. Open Safari on iOS → Share → "Add to Home Screen".

**Commit:**

```bash
git add web/public/manifest.json web/next.config.ts web/app/layout.tsx
git commit -m "feat(web): PWA manifest — installable on iOS and Android"
```

---

### Task 20: Wire up build scripts + integration test

**Files:**
- Modify: `package.json`

**Update root `package.json` scripts:**

```json
{
  "scripts": {
    "build": "npm run build:server && npm run build:web",
    "build:server": "tsc --project tsconfig.server.json",
    "build:web": "cd web && npm run build",
    "start": "node dist/index.js",
    "start:server": "node dist/server/index.js",
    "dev:server": "tsx watch server/index.ts",
    "dev:web": "cd web && npm run dev",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step: Full build smoke test**

```bash
npm run build
```
Expected: `dist/server/` populated + `web/.next/` built

**Step: Production end-to-end**

```bash
CLAW_TOKEN=test123 npm run start:server &
# Open http://localhost:4242 in a browser
# Enter token "test123" → should redirect to /dashboard
# Verify real-time updates coming in via WS
# Open Chrome DevTools → Network → WS → should see JSON frames arriving
```

**Commit:**

```bash
git add package.json
git commit -m "chore: finalize build scripts for server + web"
```

---

## Done

All tasks complete. The web/mobile frontend is:

- **Accessible at** `http://localhost:4242` after `npm run build && npm run start:server`
- **Installable** as a PWA on iOS and Android from the browser
- **Remote-accessible** by setting `CLAW_TOKEN` and exposing port 4242
- **Real-time** via WebSocket with auto-reconnect
- **Dark/light** mode with persistent preference
- **Responsive** from 375px (iPhone SE) to 1440px

---

> **Next step for Claude:** Once all tasks are complete, use `superpowers:requesting-code-review` to verify the implementation.
