# claw-monitor Web & Mobile Frontend — Design Document

**Date:** 2026-02-27
**Status:** Approved
**Stack:** Node.js server + Next.js 14 PWA + shadcn/ui + Tailwind
**Real-time:** WebSocket
**Auth:** Bearer Token (env var)

---

## 1. Goals

Enable users to monitor claw-monitor data from:
1. **Local browser** — same machine as OpenClaw, `localhost:4242`
2. **Remote device** — phone or PC accessing a server running OpenClaw, via public IP/domain + token auth

No native mobile app required — responsive PWA (Progressive Web App) provides a first-class mobile experience installable from the browser.

---

## 2. Architecture

### Repository Layout (Monorepo)

```
claw-monitor/
├── src/                    # Existing CLI — unchanged
├── bin/                    # Existing CLI entry — unchanged
├── server/                 # NEW: WebSocket + HTTP server
│   ├── index.ts            # Entry point: starts HTTP + WS on port 4242
│   ├── auth.ts             # Token middleware (Bearer + ?token= query param)
│   ├── ws.ts               # WebSocket manager: broadcasts typed messages to clients
│   ├── snapshot.ts         # One-shot full-state collector for /api/snapshot
│   ├── types.ts            # Shared TypeScript interfaces (imported by web/ too)
│   └── collectors/         # Pure-function versions of existing hook logic
│       ├── subAgents.ts    # Wraps parseSession + sessions.json reading
│       ├── codingAgents.ts # Wraps ps aux parsing
│       ├── cronJobs.ts     # Wraps openclaw cron list --json
│       ├── systemCron.ts   # Wraps crontab -l parsing
│       └── sysStats.ts     # Wraps top/df/nvidia-smi/docker/kubectl calls
└── web/                    # NEW: Next.js 14 PWA frontend
    ├── app/
    │   ├── layout.tsx           # Root layout: font, theme provider, WS context
    │   ├── page.tsx             # Login/unlock page (token entry)
    │   └── dashboard/
    │       ├── page.tsx         # Main dashboard (sub-agents + system stats)
    │       ├── agents/page.tsx  # Agent list + detail
    │       ├── cron/page.tsx    # OpenClaw + system cron jobs
    │       └── system/page.tsx  # System stats full view
    ├── components/
    │   ├── AgentCard.tsx        # Agent status card
    │   ├── AgentDrawer.tsx      # Bottom sheet (mobile) / side panel (desktop)
    │   ├── ResourceBar.tsx      # CPU/MEM/DISK bar with color thresholds
    │   ├── CronTable.tsx        # Cron jobs table
    │   ├── ContainerList.tsx    # Docker + K8s pod list
    │   ├── StatusDot.tsx        # Pulsing live indicator
    │   ├── ConnectionBanner.tsx # Reconnecting state banner
    │   └── ThemeToggle.tsx      # Dark/light mode switch
    ├── hooks/
    │   ├── useWebSocket.ts      # WS connection, auto-reconnect, message routing
    │   └── useDashboardData.ts  # Aggregates WS messages into typed state
    └── lib/
        ├── auth.ts              # Token storage (localStorage)
        └── format.ts            # Elapsed time, cron labels, truncation
```

### Data Flow

```
Browser / Phone
  │ 1. GET /api/snapshot  (initial load, avoids white screen)
  │ 2. WS ws://host:4242/ws?token=xxx  (ongoing real-time)
  ▼
server/ws.ts  (broadcasts typed JSON frames to all connected clients)
  ▼
server/collectors/  (reuse parseSession, cronUtils, config from src/utils/)
  ▼
OpenClaw sessions dir / ps aux / docker ps / kubectl / ...
```

### Deployment

```bash
# Start server (serves web/ static build + WebSocket)
CLAW_TOKEN=my-secret npm run start:server

# Dev mode
npm run dev:server   # ts-node server/index.ts --watch
npm run dev:web      # next dev (connects to localhost:4242)
```

---

## 3. Backend API

### Authentication

- Set via `CLAW_TOKEN` environment variable at startup
- All requests: `Authorization: Bearer <token>` header
- WebSocket: `ws://host:4242/ws?token=<token>` query param
- No token set → server binds to localhost only (safe default)
- Wrong token → HTTP 401 / WS close 1008

### HTTP Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{"ok": true, "version": "x.x.x"}` |
| GET | `/api/snapshot` | Yes | Full state snapshot (all collectors, one shot) |

### WebSocket Messages (server → client)

```typescript
// server/types.ts (shared with web/)
type WsMessage =
  | { type: 'agents';  data: SubAgentData[]   }   // 500ms
  | { type: 'coding';  data: CodingAgent[]    }   // 5s
  | { type: 'cron';    data: CronJobData[]    }   // 15s
  | { type: 'syscron'; data: SysCronJob[]     }   // 60s
  | { type: 'stats';   data: SysStats         }   // 10s
  | { type: 'error';   data: { message: string } }
```

Intervals match existing CLI defaults; all configurable via same env vars (`POLL_AGENTS`, `POLL_STATS`, etc.).

---

## 4. UI Design System

### Style

**Dark Mode OLED** default, **Light Mode** available via toggle.
Source: UI/UX Pro Max — "Real-Time Monitoring" + "Dark Mode OLED" styles.

### Color Palette

```css
/* CSS Variables — dark mode */
:root.dark {
  --bg:       #020617;  /* slate-950  — OLED black */
  --card:     #0F172A;  /* slate-900  — card surface */
  --border:   #1E293B;  /* slate-800  — dividers */
  --text:     #F8FAFC;  /* slate-50   — primary text */
  --muted:    #94A3B8;  /* slate-400  — secondary text */
}

/* Light mode */
:root {
  --bg:       #F8FAFC;  /* slate-50   */
  --card:     #FFFFFF;
  --border:   #E2E8F0;  /* slate-200  */
  --text:     #0F172A;  /* slate-900  */
  --muted:    #475569;  /* slate-600  — meets 4.5:1 contrast */
}

/* Status colors — same in both modes */
--running:  #22C55E;   /* green-500 */
--complete: #64748B;   /* slate-500 */
--error:    #EF4444;   /* red-500   */
--warning:  #F59E0B;   /* amber-500 */
--info:     #3B82F6;   /* blue-500  */
```

### Typography

| Role | Font | Weight |
|------|------|--------|
| Headings / Labels | Fira Sans | 500, 600 |
| Numbers / Timestamps / Code | Fira Code | 400, 500 |
| Body text | Fira Sans | 400 |

### Component Tokens (Tailwind)

- Minimum touch target: `min-h-[44px] min-w-[44px]`
- Card radius: `rounded-xl`
- Card shadow (dark): `shadow-[0_0_0_1px_rgba(255,255,255,0.06)]`
- Transitions: `transition-colors duration-200`
- Live pulse animation: `animate-pulse` on status dots
- Body font size: `text-base` (16px minimum on mobile)

---

## 5. Page & Component Design

### Login Page (`/`)

Single centered card on the background color:
- Logo + "claw-monitor" title
- Password input (type="password") with eye-toggle
- "Connect" button (full-width, green CTA)
- Stores token in `localStorage`; redirects to `/dashboard`
- Shows connection error inline (not an alert)

### Dashboard — Main (`/dashboard`)

**Mobile layout (< 768px):**
```
┌─────────────────────────────┐
│ 🦞 claw-monitor    ◉ LIVE  │  top bar: brand + connection dot + theme toggle
├─────────────────────────────┤
│ Sub-Agents (2 running)      │  section header
│ ┌─────────────────────────┐ │
│ │ ● Task A  ⠋  2m05s     │ │  agent card (tap → bottom sheet)
│ │   Bash: "npm run..."   │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ● Task B  ⠋  0m42s     │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ System                      │
│ CPU   ████░░░░  43%         │  resource bars
│ MEM   ██████░░  71%         │
│ DISK  ████░░░░  55%         │
├─────────────────────────────┤
│  Agents    Cron    System   │  bottom tab bar (44px height)
└─────────────────────────────┘
```

**Desktop layout (≥ 1024px):**
```
┌────────┬──────────────────────────────────────────────┐
│ 🦞     │  Sub-Agents (2 running)          ◉ LIVE  ☀  │
│ ─────  │  ┌──────────┐ ┌──────────┐                  │
│ Agents │  │ Task A   │ │ Task B   │                  │
│ Cron   │  └──────────┘ └──────────┘                  │
│ System │  ─────────────────────────────────────────── │
│        │  System Stats              Containers (3)    │
│        │  CPU  ████░  43%    │  ● nginx (docker)      │
│        │  MEM  ██████ 71%    │  ● redis (docker)      │
│        │  DISK ████░  55%    │  ● api-server (k8s)    │
└────────┴──────────────────────────────────────────────┘
```

### Agent Drawer

Triggered by tapping/clicking an agent card.

- **Mobile**: slides up from bottom (bottom sheet), 85vh max height, handle bar to dismiss
- **Desktop**: slides in from right (side panel), 380px wide
- Content: full label, status badge, elapsed, tool call history list (last 5), error section (red, collapsible)

### Cron Page (`/dashboard/cron`)

Two sections stacked:
1. OpenClaw Cron Jobs — table: Name / Schedule / Next Run / Last Duration / Status
2. System Cron Jobs — table: Schedule / Human-readable / Next Run / Last Run

On mobile: horizontal scroll for table, or card-per-row layout.

### System Page (`/dashboard/system`)

Resource cards in 2-column grid (mobile) / 4-column (desktop):
- CPU card: percentage + core count + streaming mini chart (last 60 readings)
- Memory card: used/total GB + percentage
- Disk card: used/total GB + mount point
- GPU card: shown only if detected

Below: Container/Pod list (full, searchable).

---

## 6. Accessibility & UX Guidelines

From UI/UX Pro Max:

- All interactive elements: `cursor-pointer`
- Touch targets: minimum `44×44px`
- Back button behavior: preserve `history.pushState()` navigation
- Loading states: skeleton cards on first load; spinner on reconnect
- `prefers-reduced-motion`: skip pulse animations, use static status dots
- Offline / disconnected: full-width `ConnectionBanner` at top (amber), auto-retries every 3s
- Error feedback: inline, next to the problem — no alert()
- Light mode text contrast: `--muted` is `#475569` (slate-600), minimum 4.5:1 on white bg

---

## 7. PWA Configuration

- `manifest.json`: name, short_name, icons (192/512), `display: standalone`, `theme_color: #020617`
- Service Worker: cache shell (Next.js static assets) for offline shell display
- Installable on iOS Safari ("Add to Home Screen") and Android Chrome
- No push notifications in v1

---

## 8. New npm Scripts

```json
"start:server":  "node dist/server/index.js",
"dev:server":    "tsx watch server/index.ts",
"dev:web":       "next dev web/",
"build:server":  "tsc --project tsconfig.server.json",
"build:web":     "next build web/",
"build":         "npm run build:server && npm run build:web"
```

---

## 9. Out of Scope (v1)

- Push notifications
- Historical data / time-series storage (data is live-only, like the CLI)
- Multi-server support (one server instance per deployment)
- User management (single token = single user)
- WebRTC / P2P connectivity
