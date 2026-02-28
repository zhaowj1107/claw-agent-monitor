# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root
```bash
npm run build           # Compile server TypeScript → dist/server/ + next build
npm run build:server    # Server only (tsc --project tsconfig.server.json)
npm run build:web       # Web only (cd web && next build)
npm run start:server    # Run server (node dist/server/index.js)
npm run dev:server      # Server watch mode (tsx watch)
npm run dev:web         # Next.js dev server → http://localhost:3000
npm run clean           # Remove dist/
npm test                # Vitest (server unit tests)
```

### Server
```bash
PORT=4243 node dist/server/index.js    # Start HTTP + WebSocket server
# Default port: 4242 · Auth: CLAW_TOKEN env var (omit for localhost no-auth mode)
# Endpoints: GET /api/health · GET /api/snapshot · WebSocket ws://host:PORT/ws
```

### Web
```bash
cd web && npm run dev    # Next.js dev server → http://localhost:3000
cd web && npm run build  # Static export → web/out/
```

Build is the primary verification step — fix all TypeScript errors before considering a change complete.

---

## Architecture Overview

This is a **monorepo** with three layers:

| Layer | Path | Purpose |
|-------|------|---------|
| TUI | `src/` | Ink 4 terminal dashboard (original app) |
| Server | `server/` | Node.js HTTP + WebSocket data server |
| Web | `web/` | Next.js 14 PWA dashboard |

---

## TUI Layer (`src/`)

Terminal dashboard built with **Ink 4** (React for CLIs) + TypeScript (ESM, strict, ES2020, NodeNext).

**Entry flow**: `src/index.tsx` → installs flicker guard on `stdout.write` → renders `<App />` via Ink.

**Data hooks** (each polls independently):
- `useSubAgents` — reads `~/.openclaw/agents/main/sessions/` + JSONL logs (500ms)
- `useCodingAgents` — parses `ps aux` for Claude/Copilot/Codex processes (5s)
- `useCronJobs` — runs `openclaw cron list --json` (15s)
- `useSystemCron` — parses `crontab -l` (60s)
- `useSysStats` — runs `top`, `df`, `nvidia-smi`, `docker ps`, `kubectl get pods` (10s)
- `useTerminalSize` — event-driven via `stdout.columns` + resize listener

Poll intervals are configurable via env vars in `src/utils/config.ts`.

**Rendering**: `App.tsx` composes sections top-to-bottom inside a box-drawing border. Width is responsive (60–120 columns) via `useTerminalSize`.

**TUI Key Conventions:**
- **Box-drawing borders**: All section components render `│`/`┌─┐`/`└─┘` manually padded to `boxWidth`. Do not use Ink's `<Box borderStyle>`.
- **`fit()` utility** (`src/utils/cronUtils.ts`): Truncates/pads strings to exact column width. Required for all table columns.
- **Emoji width**: Emoji count as 2 visual columns but 1 JS character — account for this in padding math.
- **Anti-flicker**: `useSubAgents` and `useCodingAgents` use ref-based comparison to skip `setState` when data is unchanged.
- **Flicker guard** (`src/index.tsx`): Intercepts `stdout.write` to skip re-renders when frame content is identical.
- **Warnings**: Hooks return `warning?: string` when optional commands are unavailable. Render as yellow `⚠` lines.

**Adding new TUI sections:**
1. Create hook in `src/hooks/` — poll data, return typed state + optional `warning`
2. Create component in `src/components/` — render within box-drawing borders, accept `boxWidth`
3. Wire into `App.tsx`

---

## Server Layer (`server/`)

Node.js HTTP + WebSocket server. No Express — uses built-in `http` module.

**Compiled to**: `dist/server/` via `tsconfig.server.json`

**Entry point**: `server/index.ts` → `dist/server/index.js`

**Collectors** (pure functions, no side effects, called on each poll):
- `subAgents.ts` — reads `~/.openclaw/agents/main/sessions/`
- `codingAgents.ts` — `ps aux` parser for CC / GHCP / Codex processes
- `codexSession.ts` — scans `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (latest 5 by mtime), parses all event types
- `cronJobs.ts` — `openclaw cron list --json`
- `systemCron.ts` — `crontab -l`
- `sysStats.ts` — `top`, `df`, `nvidia-smi`, `docker ps`, `kubectl get pods`

**Snapshot**: `snapshot.ts` calls all collectors and returns `SnapshotPayload`.

**WebSocket**: `ws.ts` sends initial burst of all data types on connect, then polls each on its own interval. Auth via `CLAW_TOKEN` env var; omit for localhost no-auth mode.

**Shared types**: `server/types.ts` — `SubAgentData`, `CodingAgent`, `CodexSession`, `CodexStep`, `CronJobData`, `SysStats`, `SnapshotPayload`, `WsMessage`. These are imported directly by the web layer.

**Adding new data sources:**
1. Create `server/collectors/mySource.ts` — export `collectMySource(): MyType[]`
2. Add types to `server/types.ts` + extend `SnapshotPayload` and `WsMessage`
3. Wire into `server/snapshot.ts` and `server/ws.ts`

---

## Web Layer (`web/`)

Next.js 14 App Router, static export, shadcn/ui, Tailwind CSS.

**Design system:**
- Font: **Plus Jakarta Sans** (headings/body), **JetBrains Mono** (code)
- Style: Glassmorphism — `backdrop-blur`, `bg-card/50`, `border-border/50`
- Palette: Deep navy base (`hsl(229 84% 5%)`), violet accent (`hsl(250 84% 65%)`)
- CSS tokens: HSL variables in `globals.css` (consumed as `hsl(var(--token))` by Tailwind)

**Routes:**
- `/` — Login (token entry → `localStorage`)
- `/dashboard` — Main view: KPI row, Coding Agents, Sub-Agent Sessions, System Resources
- `/dashboard/cron` — Cron jobs table
- `/dashboard/system` — Containers (Docker/k8s)

**Key components:**
- `Topbar` — glassmorphism nav with connection status pill
- `AgentCard` — glass card with left status border, hover lift; click → `AgentDrawer`
- `AgentDrawer` — full session details (bottom sheet mobile / side panel desktop)
- `CodingAgentCard` — shows Codex prompt preview; click → `CodexDrawer`
- `CodexDrawer` — live session viewer: prompt, reasoning, tool calls, outputs
- `ResourceBar` — CPU/Memory/Disk/GPU usage bars
- `ConnectionBanner` — amber banner shown when WebSocket is disconnected

**Hooks:**
- `useWebSocket` — manages WebSocket lifecycle, reconnect, auth token
- `useDashboardData` — aggregates all `WsMessage` types into `DashboardData` state

**Web Key Conventions:**
- Import types directly from `../../server/types` (no duplication)
- All components are `'use client'` unless they are pure layout/static
- Stale `.next/` cache causes `Cannot find module './NNN.js'` errors — fix by deleting `.next/` and restarting

---

## Codex Session Data

Codex stores sessions at `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl`.

Each line is a JSON event:
```jsonc
{"type":"event_msg",     "payload":{"type":"user_message",       "message":"…"}}
{"type":"event_msg",     "payload":{"type":"agent_reasoning",    "text":"…"}}
{"type":"response_item", "payload":{"type":"function_call",      "name":"shell_command", "arguments":"{…}", "call_id":"…"}}
{"type":"response_item", "payload":{"type":"function_call_output","call_id":"…", "output":"…"}}
```

The collector resets `steps[]` on each `user_message`, so only the current turn's activity is shown in the drawer.
