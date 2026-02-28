import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { CodexSession, CodexStep } from '../types.js';

const PROJECTS_ROOT = resolve(homedir(), '.claude', 'projects');

interface RolloutFile {
  path: string;
  mtime: number;
}

// Walk ~/.claude/projects/<slug>/<uuid>.jsonl (top-level only, skip /subagents/)
export function findClaudeCodeFiles(limit = 20): RolloutFile[] {
  const files: RolloutFile[] = [];

  let projectDirs: string[];
  try { projectDirs = readdirSync(PROJECTS_ROOT); } catch { return []; }

  for (const projectDir of projectDirs) {
    const projectPath = join(PROJECTS_ROOT, projectDir);
    let st;
    try { st = statSync(projectPath); } catch { continue; }
    if (!st.isDirectory()) continue;

    let entries: string[];
    try { entries = readdirSync(projectPath); } catch { continue; }

    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue;
      const full = join(projectPath, entry);
      // Skip if path contains /subagents/
      if (full.includes('/subagents/')) continue;
      let fileSt;
      try { fileSt = statSync(full); } catch { continue; }
      if (fileSt.isFile()) {
        files.push({ path: full, mtime: fileSt.mtimeMs });
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, limit);
}

/** Extract text from Claude Code content field */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .filter(c => c.type === 'text')
      .map(c => String(c.text ?? ''))
      .join('')
      .trim();
  }
  return '';
}

export function parseClaudeCodeSession(filePath: string, mtime: number): CodexSession | null {
  let raw: string;
  try { raw = readFileSync(filePath, 'utf-8'); } catch { return null; }

  const lines = raw.split('\n').filter(l => l.trim());
  let prompt = '';
  let startedAt = '';
  let cwd: string | undefined;
  const steps: CodexStep[] = [];

  for (const line of lines) {
    let entry: unknown;
    try { entry = JSON.parse(line); } catch { continue; }
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;

    // Skip metadata / file-history snapshots
    if (obj.type === 'file-history-snapshot' || obj.type === 'summary') continue;

    // Extract startedAt from first entry with parentUuid === null
    if (!startedAt && obj.parentUuid === null && obj.timestamp) {
      startedAt = String(obj.timestamp);
    }

    // Extract cwd
    if (!cwd && typeof obj.cwd === 'string') {
      cwd = obj.cwd;
    }

    const msgType = obj.type as string;
    const content = obj.message
      ? (obj.message as Record<string, unknown>).content
      : obj.content;

    if (msgType === 'user') {
      // Check if content is tool_result array → function_call_output
      if (Array.isArray(content) && content.length > 0) {
        const first = content[0] as Record<string, unknown>;
        if (first.type === 'tool_result') {
          const toolContent = Array.isArray(first.content)
            ? (first.content as Record<string, unknown>[])
                .filter(c => c.type === 'text')
                .map(c => String(c.text ?? ''))
                .join('\n')
            : String(first.content ?? '');
          steps.push({
            type: 'function_call_output',
            callId: String(first.tool_use_id ?? ''),
            output: toolContent,
          });
          continue;
        }
      }
      // Plain user message
      const text = extractText(content);
      if (text) {
        if (!prompt) prompt = text;
        steps.push({ type: 'user_message', text });
      }
    } else if (msgType === 'assistant') {
      if (!Array.isArray(content)) continue;
      const contentArr = content as Record<string, unknown>[];

      for (const block of contentArr) {
        if (block.type === 'thinking') {
          const text = String(block.thinking ?? '').trim();
          if (text) steps.push({ type: 'agent_reasoning', text });
        } else if (block.type === 'tool_use') {
          steps.push({
            type: 'function_call',
            name: String(block.name ?? ''),
            arguments: typeof block.input === 'string'
              ? block.input
              : JSON.stringify(block.input ?? {}),
            callId: String(block.id ?? ''),
          });
        } else if (block.type === 'text') {
          const text = String(block.text ?? '').trim();
          if (text) steps.push({ type: 'assistant_message', text });
        }
      }
    }
  }

  if (!prompt && steps.length === 0) return null;

  return {
    filePath,
    startedAt: startedAt || new Date(mtime).toISOString(),
    lastModifiedAt: new Date(mtime).toISOString(),
    prompt,
    steps,
    initiator: 'user',
    tool: 'claude-code',
    cwd,
  };
}

export function collectClaudeCodeSessions(): CodexSession[] {
  const files = findClaudeCodeFiles(20);
  const sessions: CodexSession[] = [];
  for (const { path, mtime } of files) {
    const session = parseClaudeCodeSession(path, mtime);
    if (session) sessions.push(session);
  }
  return sessions;
}
