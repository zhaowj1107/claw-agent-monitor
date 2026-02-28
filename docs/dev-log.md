# Dev Log — claw-monitor

Reverse-chronological development history.

---

## 2026-02-27 — Codex Sessions: Initiator Detection + Session Detail Enhancements

### Feature: User vs Agent Session Distinction

**Goal:** Distinguish sessions started by a human (`codex` CLI) from those spawned programmatically by OpenClaw.

**Signal:** The very first line of every rollout JSONL is a `session_meta` event with a `source` field:
- `source: "exec"` + `originator: "codex_exec"` → spawned by OpenClaw as a sub-agent
- `source: "cli"` + `originator: "codex_cli_rs"` → started by the user from a terminal

**Changes:**

`server/types.ts` — added `initiator` field to `CodexSession`:
```ts
initiator: 'user' | 'agent';
```

`server/collectors/codexSession.ts` — `parseRollout` now reads the `session_meta` event before processing other lines:
```ts
if (obj.type === 'session_meta') {
  if (payload?.source === 'exec') initiator = 'agent';
  continue;
}
```

**UI badges** — displayed on both `CodexSessionCard` (dashboard grid) and `CodexDrawer` header:

| Initiator | Badge | Colour |
|---|---|---|
| User | `User` | Blue |
| Agent | `Agent` | Orange |

**Verified:** 5 sessions classified correctly — `user` for direct CLI sessions, `agent` for all OpenClaw-dispatched code-review sessions.

---

### Feature: Session Duration in Drawer Header

Duration is shown next to the LIVE badge with a `Clock` icon:
- **Live session:** counts up from `startedAt` to `Date.now()`, re-renders every second via a `setInterval` tick state
- **Finished session:** static elapsed from `startedAt` to `lastModifiedAt`
- **Format:** `34s` / `2m 05s` / `1h 12m`

Implementation: `useClock`-style `tick` state in `CodexDrawer`, interval runs only when `isLive(current)` is true.

---

### Feature: Step-type Filter Bar

A horizontal strip of toggle chips between the header and prompt bar in `CodexDrawer`. All chips are enabled by default; clicking toggles visibility.

| Chip | Icon | Colour | Hides |
|---|---|---|---|
| Reasoning | `Cpu` | Purple | `agent_reasoning` |
| Output | `Bot` | Violet | `assistant_message` |
| Action | `Zap` | Sky | `agent_message` |
| Tool Call | `Wrench` | Green | `function_call` + `function_call_output` |

`user_message` (Prompt) is always visible as the structural anchor. If all steps are filtered out, a "All steps hidden — enable a filter above" message is shown in the content area.

Filter state: `Set<FilterKey>` in `CodexDrawer`, toggled per chip. Filtered list computed before render — no changes to the data layer.

---

## 2026-02-27 — Sub-Agent Sessions: OpenClaw Agent Discovery

**Goal:** Show all configured OpenClaw sub-agents in the "Sub-Agent Sessions" dashboard section, using `openclaw agents list --json` rather than hard-coding agent types.

### Data Flow

```
openclaw agents list --json
        ↓ collectOpenClawAgents() [server/collectors/openclawAgents.ts]
        ↓ buildSnapshot() / ws.ts interval (POLL_CRON)
        ↓ WsMessage { type: 'openclawAgents', data: OpenClawAgent[] }
        ↓ useDashboardData → data.openclawAgents
        ↓ OpenClawAgentCard components in Sub-Agent Sessions section
```

### New Files

**`server/collectors/openclawAgents.ts`:**
- `execSync('openclaw agents list --json', { timeout: 5000 })`
- Parses `identityEmoji` field via regex (`/\p{Emoji}/u`) to extract first emoji char
- Returns `OpenClawAgent[]` with `id`, `name`, `emoji | null`, `model`, `isDefault`, `workspace`
- Returns `[]` on any error (CLI not found, timeout, parse failure)

### Type Changes (`server/types.ts`)

```ts
export interface OpenClawAgent {
  id: string;
  name: string;
  emoji: string | null;
  model: string;
  isDefault: boolean;
  workspace: string;
}
```

`SnapshotPayload` and `WsMessage` extended with `openclawAgents: OpenClawAgent[]`.

### Dashboard Changes (`web/app/dashboard/page.tsx`)

**`OpenClawAgentCard`** — displays:
- Emoji icon (or `Layers` fallback) with running/idle colour
- Agent name + Running (green pulse) / Idle badge
- `shortModel()` strips provider prefix (e.g. `minimax-cn/MiniMax-M2.5` → `MiniMax-M2.5`)
- Session count + "View sessions →" hover hint when clickable

**Running detection:** `AGENT_CODING_TYPE` map (`{ codex: 'Codex', 'claude-code': 'CC' }`) links agent IDs to `data.coding` process types. Agents without a mapping are always Idle.

**Section layout:** Sub-Agent Sessions shows `subAgents` (non-default) + active JSONL session cards side-by-side in same grid.

**Verified:** 4 agents returned — `main` (🦞 Clawd), `codex`, `claude-code`, `gemini`.

---

## 2026-02-27 — Codex: Complete Event Coverage + Real-time Streaming

### Bug: Missing Final Reply

**Root cause:** The JSONL format has two event types that carry user-facing output — both were absent from the original parser:

| Event | Payload type | Content | When |
|---|---|---|---|
| `event_msg` | `agent_message` | Short action commentary ("I'll use skill-installer for…") | Before tool execution |
| `response_item` | `message` (role=`assistant`, content `output_text`) | Full final reply to user | After all tool calls complete |

The `response_item/message` event with `role=assistant` wraps text in a `content` array:
```json
{ "type": "message", "role": "assistant", "content": [{ "type": "output_text", "text": "…" }] }
```
Other `response_item/message` events (`role=developer`, `role=user`) are system context — ignored.

**Fix:** Added two new `CodexStepType` values and corresponding parsing branches in `parseRollout`:
- `agent_message` — `event_msg.payload.message`
- `assistant_message` — joins all `output_text` items from `response_item/message` (role=assistant)

Updated `CodexStepType`:
```ts
type CodexStepType =
  | 'user_message' | 'agent_reasoning' | 'agent_message' | 'assistant_message'
  | 'function_call' | 'function_call_output';
```

Updated `StepRow` rendering:

| Step type | Icon | Colour | Notes |
|---|---|---|---|
| `agent_message` | `Zap` | Sky | Short action intent |
| `assistant_message` | `Bot` | Violet | Full reply, slightly highlighted background |

**Note:** Sessions using `gpt-5.3-codex` (Feb 27 onwards) produce no `assistant_message` while running — the final reply is only written when the session completes.

---

### Feature: Historical Session Browser + Full Multi-turn View

**Changes to `server/collectors/codexSession.ts`:**
- `findRolloutFiles` now exported (used by watcher); limit raised from 5 → 20
- `parseRollout` now keeps **all turns** (removed the `steps.length = 0` reset on `user_message`)
- `parseRollout` now accepts `mtime: number` and returns `lastModifiedAt` on each session
- `collectCodexSessions` signature unchanged

**New `server/codexWatcher.ts`:**
- Global singleton — initialises on first import, independent of WebSocket connections
- `findRolloutFiles` → watches the most-recently-modified file with `fs.watch`
- On file change: 150 ms debounce → re-reads only the watched file → splices into cached array → broadcasts to all subscribers
- Every 10 s: full refresh of all 20 sessions + re-targets watcher if a newer active file appeared
- Active = `lastModifiedAt` within 60 s
- Exports: `getCodexSessions()`, `subscribeCodex(fn) → unsubscribe`

**`server/ws.ts`:** replaced `setInterval(collectCodexSessions)` with `subscribeCodex` per connection; `unsubCodex()` called on close. Codex updates are now event-driven (~150 ms latency) instead of 5 s polling.

**`server/snapshot.ts`:** uses `getCodexSessions()` (watcher cache) instead of calling the collector directly.

**`web/app/dashboard/page.tsx`:**
- Removed `CodingAgentCard`'s dependency on Codex process being alive
- Added standalone **Codex Sessions** section — visible whenever `data.codex.length > 0`, regardless of running processes
- New `CodexSessionCard` component: date/time, prompt preview (2 lines), turn count, tool-call count, **LIVE** badge (mtime < 60 s)
- Active sessions show green border; historical sessions show default border

**`web/components/CodexDrawer.tsx`:**
- `sessions: CodexSession[]` + `initialSession` props replace single `session` prop
- Internal `current` state syncs with `sessions` prop when `filePath` matches and `steps.length` changes → live updates while drawer is open
- `userScrolledUp` ref: auto-scroll pauses if user has scrolled up > 80 px from bottom; resumes when they scroll back down
- **LIVE badge** in header (pulsing green dot) when `lastModifiedAt < 60 s`
- **Session picker** dropdown: lists all sessions with date + prompt preview; active sessions labelled "latest"
- **← → nav buttons** for stepping through sessions by index
- Header shows `N turns · M steps` count
- Reasoning steps are collapsible (click label to toggle)
- Turn index annotated on each `user_message` ("Turn 1", "Turn 2", …)

---

## 2026-02-27 — Codex Session Content Viewer (initial)

> Superseded by the entries above. Kept for history.

**Goal:** Make the Codex agent card clickable, showing session prompt, reasoning, and tool calls.

### Data Flow

```
~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl
        ↓ collectCodexSessions() [server/collectors/codexSession.ts]
        ↓ buildSnapshot() / ws.ts polling (5 s)
        ↓ WsMessage { type: 'codex', data: CodexSession[] }
        ↓ useDashboardData → data.codex
        ↓ CodingAgentCard (click) → CodexDrawer
```

**Initial `CodexStepType`:** `user_message` | `agent_reasoning` | `function_call` | `function_call_output`

**Initial `CodexSession`:** `filePath`, `startedAt`, `prompt`, `steps[]` (last turn only)

**Initial parsing limitations:**
- Only captured last turn (reset `steps[]` on each `user_message`)
- Limit of 5 sessions
- Missing `agent_message` and `assistant_message` event types
- Polling-based updates (5 s latency for live sessions)
- Sessions only accessible via `CodingAgentCard` — hidden when Codex process not running

**Verified:** `GET /api/snapshot` → 3 sessions, 382 steps in most recent.

---

## 2026-02-27 — UI Redesign: Modern Glassmorphism

**Goal:** Replace CLI/pixel aesthetic with a modern SaaS dark-mode UI.

**Design system** (generated via `ui-ux-pro-max` skill):
- Font: **Plus Jakarta Sans** (headings + body), **JetBrains Mono** (code)
- Style: Glassmorphism — `backdrop-blur`, translucent `bg-card/50`, subtle borders at `border-border/50`
- Palette: Deep navy base (`hsl(229 84% 5%)`), violet accent (`hsl(250 84% 65%)`), proper HSL tokens throughout

**Files redesigned:**
- `web/app/globals.css` — Fixed broken HSL tokens (were raw RGB), added `body::before` ambient gradient, `.glass` utility class
- `web/app/layout.tsx` — Replaced Fira Code/Sans with Plus Jakarta Sans from `next/font/google`
- `web/components/StatusDot.tsx` — Glow shadow for running/failed states
- `web/components/ConnectionBanner.tsx` — Slim amber bar with Lucide `WifiOff`
- `web/components/ResourceBar.tsx` — Stacked label+bar layout, coloured value text
- `web/components/AgentCard.tsx` — Glass card with left status border, hover lift
- `web/components/AgentDrawer.tsx` — Glass side panel
- `web/components/Topbar.tsx` — Glassmorphism nav, `Activity` brand icon, connection pill
- `web/components/CronTable.tsx` — Uppercase headers, `Clock` icon
- `web/app/dashboard/layout.tsx` — Modern sidebar with active-indicator dot, bottom mobile nav
- `web/app/dashboard/page.tsx` — KPI row + Coding Agents section + Sub-Agent Sessions + System Resources
- `web/app/page.tsx` — Login page with ambient gradient blobs, glass card, glow button

**Bug fixed:** Stale `.next/` webpack chunks (`Cannot find module './948.js'`) after redesign — resolved by deleting `.next/` cache and restarting dev server.

---

## 2026-02-27 — Web Frontend: Tasks 16–20

Completed the remaining tasks from the implementation plan (`docs/plans/2026-02-27-web-mobile-frontend-implementation.md`):

| Task | Description |
|------|-------------|
| 16 | `AgentCard` component — glass card with status dot, tool count, elapsed time |
| 17 | `AgentDrawer` — bottom sheet (mobile) + side panel (desktop) with full session details |
| 18 | Login page (`web/app/page.tsx`) — token entry, stores to `localStorage` |
| 19 | Dashboard layout — `Topbar`, sidebar nav, mobile bottom nav |
| 20 | System page — containers (Docker/k8s) + cron table |

---

## 2026-02-27 — Web Frontend: Tasks 1–15 (Initial Build)

Bootstrapped the full `web/` + `server/` stack from scratch per the implementation plan.

**Server (`server/`):**
- HTTP server (Node `http`, no Express) on port 4242 (configurable via `PORT` env)
- WebSocket at `/ws` with optional Bearer-token auth (`CLAW_TOKEN` env)
- `/api/snapshot` HTTP endpoint for initial page load
- Collectors: `subAgents`, `codingAgents`, `cronJobs`, `systemCron`, `sysStats`
- TypeScript strict mode, ESM, compiled to `dist/server/`

**Web (`web/`):**
- Next.js 14 App Router, static export (`output: 'export'`)
- shadcn/ui + Tailwind CSS
- Design tokens in `globals.css` (HSL CSS variables)
- Auth flow: token stored in `localStorage`, sent as `?token=` query param on WebSocket
- Real-time via `useWebSocket` hook → `useDashboardData` aggregator
- Components: `StatusDot`, `ConnectionBanner`, `ResourceBar`, `ThemeToggle`
- Routes: `/` (login), `/dashboard` (main), `/dashboard/cron`, `/dashboard/system`

**Server deployment note:** Port 4242 was occupied by an existing process; server now runs on `PORT=4243` by default in this dev environment.
