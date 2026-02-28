import { execSync } from 'child_process';
import type { OpenClawAgent } from '../types.js';

interface RawAgent {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  model?: string;
  isDefault?: boolean;
  workspace?: string;
}

export function collectOpenClawAgents(): OpenClawAgent[] {
  let raw: string;
  try {
    raw = execSync('openclaw agents list --json', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return [];
  }

  let list: RawAgent[];
  try {
    list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
  } catch {
    return [];
  }

  return list.map(a => ({
    id: a.id,
    name: a.identityName ?? a.name ?? a.id,
    emoji: a.identityEmoji
      ? extractEmoji(a.identityEmoji)
      : null,
    model: a.model ?? '',
    isDefault: a.isDefault ?? false,
    workspace: a.workspace ?? '',
  }));
}

/** Pull the first emoji character out of an identityEmoji string. */
function extractEmoji(raw: string): string | null {
  const m = raw.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  return m ? m[0] : null;
}
