// server/collectors/subAgents.ts
// Pure function version of src/hooks/useSubAgents.ts — no React, no state, no watchers.
import * as fs from 'fs';
import * as path from 'path';
import { parseSession } from '../utils/parseSession.js';
import { SESSIONS_DIR, SESSIONS_JSON, MAX_SESSIONS } from '../utils/config.js';
import type { SubAgentData } from '../types.js';

interface SessionMeta {
  sessionId: string;
  label?: string;
  updatedAt?: number;
  abortedLastRun?: boolean;
}

interface SessionsData {
  labels: Map<string, string>;
  activeSessionIds: Set<string>;
  subagentSessionIds: Set<string>;
}

// Load metadata from OpenClaw's sessions.json
function loadSessionsData(): SessionsData {
  const labels = new Map<string, string>();
  const activeSessionIds = new Set<string>();
  const subagentSessionIds = new Set<string>();

  try {
    if (fs.existsSync(SESSIONS_JSON)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_JSON, 'utf-8'));
      const now = Date.now();

      for (const [key, value] of Object.entries(data)) {
        const meta = value as SessionMeta;
        if (!meta.sessionId) continue;

        // Track if this is a subagent
        if (key.includes('subagent')) {
          subagentSessionIds.add(meta.sessionId);

          // Store label if present
          if (meta.label) {
            labels.set(meta.sessionId, meta.label);
          }

          // Check if recently active (within last 60 seconds)
          if (meta.updatedAt && (now - meta.updatedAt) < 60000) {
            activeSessionIds.add(meta.sessionId);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { labels, activeSessionIds, subagentSessionIds };
}

// Main exported collector — pure function, no side effects.
export function collectSubAgents(showAll = false): SubAgentData[] {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return [];
  }

  const { labels, activeSessionIds, subagentSessionIds } = loadSessionsData();

  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl') && !f.includes('.lock') && !f.includes('.deleted'))
    .map(f => path.join(SESSIONS_DIR, f));

  let sessions = files
    .map(f => {
      const session = parseSession(f);
      if (!session) return null;

      // Extract session ID from filename
      const sessionId = path.basename(f, '.jsonl');

      // Only include subagent sessions
      if (!subagentSessionIds.has(sessionId)) {
        return null;
      }

      // Use OpenClaw label if available
      const label = labels.get(sessionId);
      if (label) {
        session.label = label;
      }

      // Use OpenClaw's active status instead of file mtime heuristic
      if (activeSessionIds.has(sessionId)) {
        session.status = 'running';
      } else if (session.status === 'running') {
        // File says running but OpenClaw says not active = complete
        session.status = 'complete';
      }

      return session as SubAgentData;
    })
    .filter((s): s is SubAgentData => s !== null)
    .sort((a, b) => b.startTime - a.startTime);

  // Filter to running only unless showAll is true
  if (!showAll) {
    sessions = sessions.filter(s => s.status === 'running');
  } else {
    sessions = sessions.slice(0, MAX_SESSIONS);
  }

  return sessions;
}
