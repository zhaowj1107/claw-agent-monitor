// Mirrors SessionData from src/utils/parseSession.ts but without React deps
export interface SubAgentData {
  label: string;
  status: 'running' | 'complete' | 'failed';
  elapsed: number;
  currentTool: string | null;
  toolArgs: string | null;
  toolCount: number;
  recentTools: string[];
  errorDetails: string | null;
  filePath: string;
  startTime: number;
}

export interface OpenClawAgent {
  id: string;
  name: string;
  /** Display emoji if set */
  emoji: string | null;
  model: string;
  isDefault: boolean;
  workspace: string;
}

export interface CodingAgent {
  type: 'CC' | 'GHCP' | 'Codex';
  pid: number;
  elapsed: string;
  command: string;
}

export type CodexStepType =
  | 'user_message'
  | 'agent_reasoning'
  | 'agent_message'        // short commentary before action
  | 'assistant_message'    // final reply to user
  | 'function_call'
  | 'function_call_output';

export interface CodexStep {
  type: CodexStepType;
  /** user_message / agent_reasoning */
  text?: string;
  /** function_call */
  name?: string;
  arguments?: string;
  callId?: string;
  /** function_call_output */
  output?: string;
}

export interface CodexSession {
  /** Rollout JSONL file path */
  filePath: string;
  /** ISO timestamp derived from filename */
  startedAt: string;
  /** File mtime — used to detect active/live sessions */
  lastModifiedAt: string;
  /** Initial user prompt */
  prompt: string;
  /** All steps across all turns */
  steps: CodexStep[];
  /**
   * Who initiated the session.
   * 'agent' = spawned programmatically by OpenClaw (source: "exec")
   * 'user'  = started from the CLI by a human (source: "cli")
   */
  initiator: 'user' | 'agent';
  /** Which tool produced this session */
  tool: 'codex' | 'claude-code' | 'gemini';
  /** Working directory for the session (if available) */
  cwd?: string;
}

export interface CronJobData {
  name: string;
  schedule: string;
  model?: string;
  nextRun: number | null;
  lastDuration?: number;
  consecutiveErrors?: number;
  isRunning?: boolean;
  source: 'openclaw' | 'system';
  lastRun?: number;
}

export interface GpuInfo {
  percent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  name: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
  status: string;
  source: 'docker' | 'k8s';
}

export interface SysStats {
  cpu: { percent: number; cores: number };
  mem: { usedGB: number; totalGB: number; percent: number };
  disk: { usedGB: number; totalGB: number; percent: number; mount: string };
  gpu: GpuInfo | null;
  containers: ContainerInfo[];
  warnings: string[];
}

export interface SnapshotPayload {
  agents: SubAgentData[];
  coding: CodingAgent[];
  cron: CronJobData[];
  syscron: CronJobData[];
  stats: SysStats;
  codex: CodexSession[];
  openclawAgents: OpenClawAgent[];
}

export type WsMessage =
  | { type: 'agents';         data: SubAgentData[] }
  | { type: 'coding';         data: CodingAgent[] }
  | { type: 'cron';           data: CronJobData[] }
  | { type: 'syscron';        data: CronJobData[] }
  | { type: 'stats';          data: SysStats }
  | { type: 'codex';          data: CodexSession[] }
  | { type: 'openclawAgents'; data: OpenClawAgent[] }
  | { type: 'error';          data: { message: string } };
