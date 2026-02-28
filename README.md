# Claw-AgentMonitor

A real-time web dashboard for monitoring AI coding agents, cron jobs, system resources, and containers. Connects to a lightweight WebSocket server that aggregates data from OpenClaw, Claude Code, Codex, Gemini CLI, Docker, and more.

## Features

### Session Viewers
- **Claude Code** — reads `~/.claude/projects/` JSONL sessions; shows reasoning, tool calls, and replies
- **Codex** — reads `~/.codex/sessions/` rollout files with full step-by-step replay
- **Gemini CLI** — reads `~/.gemini/tmp/` session files
- Click any session card to open a side drawer with full conversation history, filter chips (Reasoning / Output / Actions / Tool Calls), and live updates for active sessions

### Coding Agent Detection
- Detects running Claude Code, GitHub Copilot, and Codex processes via `ps aux`
- Shows PID, elapsed time, and command preview

### OpenClaw Sub-Agent Monitoring
- Tracks sub-agent sessions from `~/.openclaw/agents/main/sessions/`
- Shows status (running / complete / failed), tool count, and elapsed time
- Click a card to inspect the full session log

### Cron Jobs
- OpenClaw scheduled jobs (`openclaw cron list --json`) — model, next run, last duration, error counts
- System crontab (`crontab -l`) — human-readable schedule, relative next-run time

### System Resources
- CPU, Memory, Disk usage bars
- GPU via `nvidia-smi` (auto-detected)
- Docker containers and Kubernetes pods

### Design
- Glassmorphism dark UI with responsive layout
- PWA — installable on iOS and Android
- Collapsible sections per tool
- WebSocket reconnects automatically

## Architecture

```
┌─────────────────────┐     WebSocket / HTTP      ┌─────────────────────┐
│   web/              │ ←────────────────────────→ │   server/           │
│   Next.js 14 PWA    │                            │   Node.js + ws      │
│   localhost:3000    │                            │   localhost:4242    │
└─────────────────────┘                            └─────────────────────┘
                                                            │
                                          ┌─────────────────┼──────────────────┐
                                          │                 │                  │
                                    ~/.claude/        ~/.codex/         ~/.gemini/
                                    ~/.openclaw/      ps aux            crontab
                                    docker / k8s      nvidia-smi
```

## Quick Start

**Requirements**: Node.js 18+, npm

```bash
git clone https://github.com/your-username/claw-agent-monitor.git
cd claw-agent-monitor
npm install
npm run build
```

**Start the server:**
```bash
npm run start:server
# Listening on http://localhost:4242
```

**Start the web frontend (dev):**
```bash
npm run dev:web
# Open http://localhost:3000
```

**Or build the frontend for production:**
```bash
npm run build:web
# Static export → web/out/
```

## Authentication

By default the server runs in **no-auth mode** (localhost only, no token required).

To require a token:
```bash
CLAW_TOKEN=your-secret npm run start:server
```

Then enter the token on the login page, or pass it as a query param:
```
ws://your-server:4242/ws?token=your-secret
```

To point the frontend at a remote server, set the env var before building:
```bash
NEXT_PUBLIC_SERVER_URL=http://your-server:4242 npm run build:web
```

## Configuration

All server tunables are set via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4242` | Server port |
| `CLAW_TOKEN` | _(unset)_ | Auth token; omit for no-auth mode |
| `OPENCLAW_DIR` | `~/.openclaw/agents/main/sessions` | OpenClaw sessions path |
| `POLL_AGENTS` | `500` | Sub-agent poll interval (ms) |
| `POLL_CODING` | `5000` | Coding agent poll interval (ms) |
| `POLL_STATS` | `10000` | System stats poll interval (ms) |
| `POLL_CRON` | `15000` | Cron poll interval (ms) |
| `POLL_SYSCRON` | `60000` | System cron poll interval (ms) |

## Development

```bash
npm run dev:server   # Server with hot reload (tsx watch)
npm run dev:web      # Next.js dev server → http://localhost:3000
npm test             # Run server unit tests (Vitest)
```

If you see a `Cannot find module './NNN.js'` error in the browser, delete `web/.next/` and restart:
```bash
rm -rf web/.next && npm run dev:web
```

## Optional Integrations

These are auto-detected at startup — no config needed if the tool is installed:

- **`nvidia-smi`** — GPU monitoring
- **Docker** — container list via `docker ps`
- **`kubectl`** — Kubernetes / k3s pod list
- **`openclaw`** — cron jobs and sub-agent sessions

## License

MIT © Weijian Zhao
