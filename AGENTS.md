# AGENTS.md — Claw-AgentMonitor Developer Guide

Context for AI coding agents working on this codebase.

## Project Overview

Web dashboard for monitoring AI coding agents (Claude Code, Codex, Gemini CLI), OpenClaw sub-agents, cron jobs, Docker containers, and system resources. Built with a Node.js WebSocket server and a Next.js 14 static PWA.

## Monorepo Structure

```
server/           # Node.js HTTP + WebSocket server
├── index.ts      # Entry point (port 4242)
├── auth.ts       # Token auth middleware
├── snapshot.ts   # Aggregates all collectors into SnapshotPayload
├── ws.ts         # WebSocket handler — initial burst + interval polling
├── codexWatcher.ts # File-watch + polling for Codex/CC/Gemini sessions
├── types.ts      # Shared types (imported by web layer too)
├── collectors/
│   ├── subAgents.ts       # ~/.openclaw/agents/main/sessions/
│   ├── codingAgents.ts    # ps aux parser
│   ├── codexSession.ts    # ~/.codex/sessions/ JSONL rollouts
│   ├── claudeCodeSession.ts # ~/.claude/projects/ JSONL sessions
│   ├── geminiSession.ts   # ~/.gemini/tmp/ session JSON files
│   ├── cronJobs.ts        # openclaw cron list --json
│   ├── systemCron.ts      # crontab -l
│   ├── sysStats.ts        # top, df, nvidia-smi, docker ps, kubectl
│   └── openclawAgents.ts  # openclaw agents list --json
└── utils/
    ├── config.ts          # Poll intervals + paths (env-var overrides)
    ├── cronUtils.ts       # cronToHuman(), nextCronRun()
    └── parseSession.ts    # OpenClaw JSONL session parser

web/              # Next.js 14 App Router, static export
├── app/
│   ├── layout.tsx         # Root layout + ThemeProvider
│   ├── page.tsx           # Login page
│   ├── error.tsx          # App Router error boundary
│   ├── global-error.tsx   # Root-level error boundary
│   ├── not-found.tsx      # 404 page
│   └── dashboard/
│       ├── layout.tsx     # Dashboard shell + Topbar + ConnectionBanner
│       ├── page.tsx       # Main dashboard: KPIs, sessions, sub-agents, resources
│       ├── cron/page.tsx  # Cron jobs table
│       └── system/page.tsx # Docker + k8s containers
├── components/
│   ├── AgentCard.tsx      # Sub-agent session card
│   ├── AgentDrawer.tsx    # Sub-agent detail side panel
│   ├── CodexDrawer.tsx    # Session viewer for Codex/CC/Gemini (tool-aware)
│   ├── CronTable.tsx      # Cron jobs table
│   ├── Topbar.tsx         # Nav + connection status
│   ├── ConnectionBanner.tsx # Disconnected warning banner
│   ├── ResourceBar.tsx    # CPU/Memory/Disk/GPU progress bar
│   ├── StatusDot.tsx      # Animated status indicator
│   └── ThemeToggle.tsx    # Dark/light mode toggle
├── hooks/
│   ├── useWebSocket.ts    # WS lifecycle, reconnect every 3s
│   └── useDashboardData.ts # Aggregates WsMessage types into DashboardData
└── lib/
    ├── auth.ts            # Token storage, server URL, WS URL helpers
    └── format.ts          # Shared formatting utilities
```

## Key Conventions

### Server
- **Collectors** are pure functions with no side effects — called fresh on each poll
- **`codexWatcher.ts`** is the exception: it maintains state and uses `fs.watch` for the active Codex file; CC and Gemini are polled every 15s
- **`server/types.ts`** is the single source of truth — web layer imports from it directly (no duplication)
- Add new data sources: create `server/collectors/mySource.ts` → extend `SnapshotPayload` + `WsMessage` in `types.ts` → wire into `snapshot.ts` and `ws.ts`

### Web
- All components are `'use client'` unless purely static
- Import types directly from `../../server/types` (relative path, no alias)
- Design: glassmorphism — `backdrop-blur`, `bg-card/50`, `border-border/50`; violet accent, deep navy base
- Font: Plus Jakarta Sans (body), JetBrains Mono (code)
- Stale `.next/` causes `Cannot find module './NNN.js'` — fix: `rm -rf web/.next`

### Session tools
`CodexSession.tool` distinguishes session sources:
| Value | Source | Collector |
|-------|--------|-----------|
| `'codex'` | `~/.codex/sessions/` | `codexSession.ts` |
| `'claude-code'` | `~/.claude/projects/` | `claudeCodeSession.ts` |
| `'gemini'` | `~/.gemini/tmp/` | `geminiSession.ts` |

## Build & Run

```bash
npm run build:server   # tsc --project tsconfig.server.json → dist/server/
npm run build:web      # next build → web/out/
npm run build          # both

npm run start:server   # node dist/server/index.js
npm run dev:server     # tsx watch server/index.ts
npm run dev:web        # cd web && next dev
npm test               # vitest run (server unit tests only)
```
