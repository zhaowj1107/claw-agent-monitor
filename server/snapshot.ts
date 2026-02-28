import { collectSubAgents } from './collectors/subAgents.js';
import { collectCodingAgents } from './collectors/codingAgents.js';
import { collectCronJobs } from './collectors/cronJobs.js';
import { collectSystemCron } from './collectors/systemCron.js';
import { collectSysStats } from './collectors/sysStats.js';
import { getCodexSessions } from './codexWatcher.js';
import { collectOpenClawAgents } from './collectors/openclawAgents.js';
import type { SnapshotPayload } from './types.js';

export function buildSnapshot(): SnapshotPayload {
  return {
    agents:         collectSubAgents(true),
    coding:         collectCodingAgents(),
    cron:           collectCronJobs().jobs,
    syscron:        collectSystemCron().jobs,
    stats:          collectSysStats(),
    codex:          getCodexSessions(),
    openclawAgents: collectOpenClawAgents(),
  };
}
