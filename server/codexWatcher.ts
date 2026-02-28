import { watch, FSWatcher, statSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { findRolloutFiles, parseRollout } from './collectors/codexSession.js';
import { collectClaudeCodeSessions } from './collectors/claudeCodeSession.js';
import { collectGeminiSessions } from './collectors/geminiSession.js';
import type { CodexSession } from './types.js';

const SESSIONS_ROOT = resolve(homedir(), '.codex', 'sessions');
const ACTIVE_THRESHOLD_MS = 60_000; // file modified within 60s → considered live

type Listener = (sessions: CodexSession[]) => void;

const listeners = new Set<Listener>();

let cachedSessions: CodexSession[] = [];
let watchedFile: string | null = null;
let fsWatcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ── helpers ──────────────────────────────────────────────────────────────────

function broadcast() {
  for (const fn of listeners) fn(cachedSessions);
}

/** Re-read ALL sessions from all sources, merge by lastModifiedAt desc, then broadcast. */
function refreshAll() {
  const codexFiles = findRolloutFiles(SESSIONS_ROOT, 20);
  const codexSessions: CodexSession[] = [];
  for (const { path, mtime } of codexFiles) {
    const session = parseRollout(path, mtime);
    if (session) codexSessions.push(session);
  }

  const ccSessions = collectClaudeCodeSessions();
  const geminiSessions = collectGeminiSessions();

  // Merge and sort by lastModifiedAt desc
  const all = [...codexSessions, ...ccSessions, ...geminiSessions];
  all.sort((a, b) =>
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime(),
  );

  cachedSessions = all;
  broadcast();
}

/** Re-read only the watched (active) Codex file, splice into cache, then broadcast. */
function refreshActive() {
  if (!watchedFile) return refreshAll();
  let mtime = Date.now();
  try { mtime = statSync(watchedFile).mtimeMs; } catch { return refreshAll(); }
  const updated = parseRollout(watchedFile, mtime);
  if (!updated) return;
  // Replace the matching codex session in the cache
  const withReplaced = cachedSessions.map(s =>
    s.filePath === watchedFile ? updated : s,
  );
  // Re-sort after update
  withReplaced.sort((a, b) =>
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime(),
  );
  cachedSessions = withReplaced;
  broadcast();
}

function startWatching(filePath: string) {
  if (watchedFile === filePath) return;
  fsWatcher?.close();
  watchedFile = filePath;
  try {
    fsWatcher = watch(filePath, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Short debounce: JSONL lines are written one at a time; wait for a quiet moment
      debounceTimer = setTimeout(refreshActive, 150);
    });
    fsWatcher.on('error', () => {
      fsWatcher = null;
      watchedFile = null;
    });
  } catch {
    watchedFile = null;
  }
}

// ── initialise ───────────────────────────────────────────────────────────────

// Full refresh every 10s — picks up new Codex sessions and updates mtime-based live status
setInterval(() => {
  const files = findRolloutFiles(SESSIONS_ROOT, 20);
  // Switch watcher if a newer file appeared
  const newestActive = files.find(f => Date.now() - f.mtime < ACTIVE_THRESHOLD_MS);
  if (newestActive && newestActive.path !== watchedFile) {
    startWatching(newestActive.path);
  }
  refreshAll();
}, 10_000);

// Separate 15s interval for Claude Code + Gemini (no fs.watch for these)
setInterval(() => {
  const ccSessions = collectClaudeCodeSessions();
  const geminiSessions = collectGeminiSessions();

  // Replace CC and Gemini entries in the cache, keep Codex entries
  const codexOnly = cachedSessions.filter(s => s.tool === 'codex');
  const all = [...codexOnly, ...ccSessions, ...geminiSessions];
  all.sort((a, b) =>
    new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime(),
  );
  cachedSessions = all;
  broadcast();
}, 15_000);

// Seed cache immediately on first import
refreshAll();
// And watch the newest active Codex file right away
{
  const files = findRolloutFiles(SESSIONS_ROOT, 20);
  const newestActive = files.find(f => Date.now() - f.mtime < ACTIVE_THRESHOLD_MS);
  if (newestActive) startWatching(newestActive.path);
}

// ── public API ───────────────────────────────────────────────────────────────

export function getCodexSessions(): CodexSession[] {
  return cachedSessions;
}

export function subscribeCodex(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
