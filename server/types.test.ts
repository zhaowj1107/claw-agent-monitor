// server/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { WsMessage, SnapshotPayload, SubAgentData, SysStats } from './types.js';

describe('WsMessage discriminated union', () => {
  it('agents message has SubAgentData[] data', () => {
    expectTypeOf<Extract<WsMessage, { type: 'agents' }>['data']>()
      .toEqualTypeOf<SubAgentData[]>();
  });

  it('stats message has SysStats data', () => {
    expectTypeOf<Extract<WsMessage, { type: 'stats' }>['data']>()
      .toEqualTypeOf<SysStats>();
  });
});
