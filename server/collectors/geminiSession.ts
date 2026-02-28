import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { CodexSession, CodexStep } from '../types.js';

const GEMINI_ROOT = resolve(homedir(), '.gemini', 'tmp');

interface RolloutFile {
  path: string;
  mtime: number;
}

// Walk ~/.gemini/tmp/<hash>/chats/session-*.json, sorted by mtime desc
export function findGeminiFiles(limit = 20): RolloutFile[] {
  const files: RolloutFile[] = [];

  let hashDirs: string[];
  try { hashDirs = readdirSync(GEMINI_ROOT); } catch { return []; }

  for (const hashDir of hashDirs) {
    const chatsPath = join(GEMINI_ROOT, hashDir, 'chats');
    let entries: string[];
    try { entries = readdirSync(chatsPath); } catch { continue; }

    for (const entry of entries) {
      if (!entry.startsWith('session-') || !entry.endsWith('.json')) continue;
      const full = join(chatsPath, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isFile()) {
        files.push({ path: full, mtime: st.mtimeMs });
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, limit);
}

/** Extract text from a Gemini message content */
function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[])
      .filter(c => c.text !== undefined)
      .map(c => String(c.text ?? ''))
      .join('')
      .trim();
  }
  return '';
}

export function parseGeminiSession(filePath: string, mtime: number): CodexSession | null {
  let raw: string;
  try { raw = readFileSync(filePath, 'utf-8'); } catch { return null; }

  let session: unknown;
  try { session = JSON.parse(raw); } catch { return null; }
  if (typeof session !== 'object' || session === null) return null;

  const obj = session as Record<string, unknown>;
  const messages = Array.isArray(obj.messages) ? obj.messages as Record<string, unknown>[] : [];

  let prompt = '';
  const startedAt = obj.startTime ? String(obj.startTime) : new Date(mtime).toISOString();
  const steps: CodexStep[] = [];

  for (const msg of messages) {
    const msgType = String(msg.type ?? '');
    if (msgType === 'error') continue;

    const text = extractMessageText(msg.content ?? msg.text);
    if (!text) continue;

    if (msgType === 'user') {
      if (!prompt) prompt = text;
      steps.push({ type: 'user_message', text });
    } else if (msgType === 'info' || msgType === 'assistant' || msgType === 'model') {
      steps.push({ type: 'assistant_message', text });
    }
  }

  if (!prompt && steps.length === 0) return null;

  return {
    filePath,
    startedAt,
    lastModifiedAt: new Date(mtime).toISOString(),
    prompt,
    steps,
    initiator: 'user',
    tool: 'gemini',
  };
}

export function collectGeminiSessions(): CodexSession[] {
  const files = findGeminiFiles(20);
  const sessions: CodexSession[] = [];
  for (const { path, mtime } of files) {
    const session = parseGeminiSession(path, mtime);
    if (session) sessions.push(session);
  }
  return sessions;
}
