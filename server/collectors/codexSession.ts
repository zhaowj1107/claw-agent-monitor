import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { CodexSession, CodexStep } from '../types.js';

const SESSIONS_ROOT = resolve(homedir(), '.codex', 'sessions');

interface RolloutFile {
  path: string;
  mtime: number;
}

/** Walk the YYYY/MM/DD tree and return .jsonl files sorted by mtime desc */
export function findRolloutFiles(root: string, limit = 20): RolloutFile[] {
  const files: RolloutFile[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 3) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.startsWith('rollout-') && entry.endsWith('.jsonl')) {
        files.push({ path: full, mtime: st.mtimeMs });
      }
    }
  }

  walk(root, 0);
  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, limit);
}

/** Extract ISO timestamp from rollout filename */
function filenameToTimestamp(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  const m = base.match(/^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (!m) return new Date().toISOString();
  return m[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3') + 'Z';
}

export function parseRollout(filePath: string, mtime: number): CodexSession | null {
  let raw: string;
  try { raw = readFileSync(filePath, 'utf-8'); } catch { return null; }

  const lines = raw.split('\n').filter(l => l.trim());
  let prompt = '';
  let initiator: 'user' | 'agent' = 'user';
  const steps: CodexStep[] = [];

  for (const line of lines) {
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { continue; }
    if (typeof parsed !== 'object' || parsed === null) continue;
    const obj = parsed as Record<string, unknown>;

    if (obj.type === 'session_meta') {
      const payload = obj.payload as Record<string, unknown> | undefined;
      if (payload?.source === 'exec') initiator = 'agent';
      continue;
    }

    if (obj.type === 'event_msg') {
      const payload = obj.payload as Record<string, unknown> | undefined;
      if (!payload) continue;
      if (payload.type === 'user_message') {
        const msg = String(payload.message ?? '').trim();
        if (!prompt) prompt = msg;
        steps.push({ type: 'user_message', text: msg });
      } else if (payload.type === 'agent_reasoning') {
        const text = String(payload.text ?? '').trim();
        if (text) steps.push({ type: 'agent_reasoning', text });
      } else if (payload.type === 'agent_message') {
        const text = String(payload.message ?? '').trim();
        if (text) steps.push({ type: 'agent_message', text });
      }
    } else if (obj.type === 'response_item') {
      const payload = obj.payload as Record<string, unknown> | undefined;
      if (!payload) continue;
      if (payload.type === 'function_call') {
        steps.push({
          type: 'function_call',
          name: String(payload.name ?? ''),
          arguments: String(payload.arguments ?? ''),
          callId: String(payload.call_id ?? ''),
        });
      } else if (payload.type === 'function_call_output') {
        steps.push({
          type: 'function_call_output',
          callId: String(payload.call_id ?? ''),
          output: String(payload.output ?? ''),
        });
      } else if (payload.type === 'message' && payload.role === 'assistant') {
        const content = Array.isArray(payload.content) ? payload.content as Record<string, unknown>[] : [];
        const text = content
          .filter(c => c.type === 'output_text')
          .map(c => String(c.text ?? ''))
          .join('')
          .trim();
        if (text) steps.push({ type: 'assistant_message', text });
      }
    }
  }

  if (!prompt && steps.length === 0) return null;

  return {
    filePath,
    startedAt: filenameToTimestamp(filePath),
    lastModifiedAt: new Date(mtime).toISOString(),
    prompt,
    steps,
    initiator,
    tool: 'codex' as const,
  };
}

export function collectCodexSessions(): CodexSession[] {
  const files = findRolloutFiles(SESSIONS_ROOT, 20);
  const sessions: CodexSession[] = [];
  for (const { path, mtime } of files) {
    const session = parseRollout(path, mtime);
    if (session) sessions.push(session);
  }
  return sessions;
}
