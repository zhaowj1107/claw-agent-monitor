'use client';
import { useCallback, useState } from 'react';
import { useWebSocket, type ConnectionState } from './useWebSocket';
import type { SubAgentData, CodingAgent, CronJobData, SysStats, CodexSession, OpenClawAgent } from '../../server/types';

export interface DashboardData {
  agents: SubAgentData[];
  coding: CodingAgent[];
  cron: CronJobData[];
  syscron: CronJobData[];
  stats: SysStats | null;
  codex: CodexSession[];
  openclawAgents: OpenClawAgent[];
}

const INITIAL: DashboardData = {
  agents: [],
  coding: [],
  cron: [],
  syscron: [],
  stats: null,
  codex: [],
  openclawAgents: [],
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(INITIAL);

  const handleMessage = useCallback((msg: { type: string; data: unknown }) => {
    if (
      msg.type === 'agents' ||
      msg.type === 'coding' ||
      msg.type === 'cron' ||
      msg.type === 'syscron' ||
      msg.type === 'stats' ||
      msg.type === 'codex' ||
      msg.type === 'openclawAgents'
    ) {
      setData(prev => ({ ...prev, [msg.type]: msg.data }));
    }
  }, []);

  const { state: connectionState } = useWebSocket(handleMessage as any);

  return { data, connectionState };
}
