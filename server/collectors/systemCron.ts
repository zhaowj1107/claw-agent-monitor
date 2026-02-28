import { execSync } from 'child_process';
import { CronJobData } from '../types.js';
import { cronToHuman, nextCronRun } from '../utils/cronUtils.js';

function extractName(command: string): string {
  const cleaned = command
    .replace(/^(sudo\s+|nice\s+(-n\s+\d+\s+)?|ionice\s+\S+\s+)/, '')
    .replace(/\s+[>|].*$/, '')
    .replace(/\s+2>&1.*$/, '')
    .trim();

  const cmd = cleaned.split(/\s+/)[0] || cleaned;
  return (cmd.split('/').pop() || cmd).substring(0, 22);
}

export function collectSystemCron(): { jobs: CronJobData[]; warning?: string } {
  let output: string;
  try {
    output = execSync('crontab -l 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return { jobs: [], warning: 'crontab -l failed' };
  }

  const jobs: CronJobData[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || /^\w+=/.test(trimmed)) continue;

    if (trimmed.startsWith('@')) {
      const match = trimmed.match(/^@(\w+)\s+(.+)$/);
      if (match) {
        const schedMap: Record<string, string> = {
          reboot: 'on reboot', hourly: 'every 1h', daily: 'daily 00:00',
          weekly: 'weekly Sun', monthly: 'monthly 1st',
          annually: 'yearly Jan 1', yearly: 'yearly Jan 1',
        };
        jobs.push({
          name: extractName(match[2]),
          schedule: schedMap[match[1]] || `@${match[1]}`,
          nextRun: null,
          source: 'system',
        });
      }
      continue;
    }

    const match = trimmed.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;

    const [, m, h, dom, mon, dow, command] = match;
    const nextMs = nextCronRun(m, h, dom, mon, dow);

    jobs.push({
      name: extractName(command),
      schedule: cronToHuman(m, h, dom, mon, dow),
      nextRun: nextMs,
      source: 'system',
    });
  }

  jobs.sort((a, b) => {
    if (a.nextRun === null && b.nextRun === null) return 0;
    if (a.nextRun === null) return 1;
    if (b.nextRun === null) return -1;
    return a.nextRun - b.nextRun;
  });

  return { jobs };
}
