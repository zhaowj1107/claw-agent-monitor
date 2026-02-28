import { execSync } from 'child_process';
import { CronJobData } from '../types.js';
import { cronToHuman, nextCronRun } from '../utils/cronUtils.js';

function humanSchedule(sched: any): string {
  if (!sched) return '?';

  if (sched.kind === 'every') {
    const ms = sched.everyMs;
    if (ms >= 3600000) return `every ${Math.round(ms / 3600000)}h`;
    if (ms >= 60000) return `every ${Math.round(ms / 60000)}m`;
    return `every ${Math.round(ms / 1000)}s`;
  }

  if (sched.kind === 'cron' && sched.expr) {
    return cronToHuman(sched.expr, sched.tz);
  }

  if (sched.kind === 'at') {
    const d = new Date(sched.at);
    return d.toISOString().replace('T', ' ').substring(0, 16);
  }

  return '?';
}

function nextRunMs(sched: any, stateNextRunAtMs?: number): number | null {
  if (stateNextRunAtMs) return stateNextRunAtMs;

  if (!sched) return null;

  if (sched.kind === 'cron' && sched.expr) {
    const parts = sched.expr.trim().split(/\s+/);
    if (parts.length >= 5) {
      const [min, hour, dom, mon, dow] = parts;
      return nextCronRun(min, hour, dom, mon, dow);
    }
  }

  return null;
}

export function collectCronJobs(): { jobs: CronJobData[]; warning?: string } {
  let output: string;
  try {
    output = execSync('openclaw cron list --json 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return { jobs: [], warning: 'openclaw cron list failed' };
  }

  try {
    const data = JSON.parse(output);
    const jobs: any[] = data.jobs || [];

    return {
      jobs: jobs
        .filter(j => j.enabled !== false)
        .map(j => {
          const state = j.state || {};
          const rawModel = j.payload?.model || j.model || undefined;
          const model = rawModel
            ? (rawModel.includes('/') ? (rawModel.split('/').pop() || rawModel) : rawModel)
            : undefined;
          return {
            name: j.name || j.id.substring(0, 8),
            model,
            schedule: humanSchedule(j.schedule),
            nextRun: nextRunMs(j.schedule, state.nextRunAtMs),
            lastDuration: state.lastDurationMs || undefined,
            consecutiveErrors: state.consecutiveErrors || 0,
            isRunning: !!state.runningAtMs,
            source: 'openclaw' as const,
            lastRun: state.lastRunAtMs || undefined,
          };
        })
        .sort((a, b) => {
          if (a.nextRun === null && b.nextRun === null) return 0;
          if (a.nextRun === null) return 1;
          if (b.nextRun === null) return -1;
          return a.nextRun - b.nextRun;
        }),
    };
  } catch {
    return { jobs: [], warning: 'Failed to parse cron job data' };
  }
}
