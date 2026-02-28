// server/snapshot.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./collectors/subAgents.js', () => ({ collectSubAgents: () => [] }));
vi.mock('./collectors/codingAgents.js', () => ({ collectCodingAgents: () => [] }));
vi.mock('./collectors/cronJobs.js', () => ({ collectCronJobs: () => ({ jobs: [] }) }));
vi.mock('./collectors/systemCron.js', () => ({ collectSystemCron: () => ({ jobs: [] }) }));
vi.mock('./collectors/sysStats.js', () => ({
  collectSysStats: () => ({
    cpu: { percent: 0, cores: 4 },
    mem: { usedGB: 0, totalGB: 8, percent: 0 },
    disk: { usedGB: 0, totalGB: 100, percent: 0, mount: '/' },
    gpu: null,
    containers: [],
    warnings: [],
  }),
}));

import { buildSnapshot } from './snapshot.js';

describe('buildSnapshot', () => {
  it('returns a SnapshotPayload with all fields', () => {
    const snap = buildSnapshot();
    expect(snap).toHaveProperty('agents');
    expect(snap).toHaveProperty('coding');
    expect(snap).toHaveProperty('cron');
    expect(snap).toHaveProperty('syscron');
    expect(snap).toHaveProperty('stats');
    expect(snap.stats.cpu.cores).toBe(4);
    expect(Array.isArray(snap.agents)).toBe(true);
  });
});
