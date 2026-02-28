'use client';
import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { AgentCard } from '@/components/AgentCard';
import { AgentDrawer } from '@/components/AgentDrawer';
import { CodexDrawer } from '@/components/CodexDrawer';
import { ResourceBar } from '@/components/ResourceBar';
import {
  Activity, CheckCircle2, XCircle, Cpu, Terminal,
  Clock, MessageSquare, Layers, Bot, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubAgentData, CodingAgent, CodexSession, OpenClawAgent } from '../../../server/types';

// ─── Model label helpers ──────────────────────────────────────────────────────

function shortModel(model: string): string {
  if (!model) return '—';
  // e.g. "minimax-cn/MiniMax-M2.5" → "MiniMax-M2.5"
  const slash = model.lastIndexOf('/');
  return slash >= 0 ? model.slice(slash + 1) : model;
}

// ─── Coding agent styles ──────────────────────────────────────────────────────

const CODING_AGENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  CC:    { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Claude Code' },
  GHCP:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',   label: 'Copilot' },
  Codex: { bg: 'bg-green-500/10',  text: 'text-green-400',  label: 'Codex' },
};

function CodingAgentCard({ agent }: { agent: CodingAgent }) {
  const style = CODING_AGENT_STYLE[agent.type] ?? { bg: 'bg-muted/50', text: 'text-muted-foreground', label: agent.type };
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-md shrink-0', style.bg)}>
          <Terminal className={cn('h-3.5 w-3.5', style.text)} />
        </div>
        <span className="flex-1 text-sm font-semibold truncate">{style.label}</span>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md tabular', style.bg, style.text)}>
          PID {agent.pid}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate pl-0.5">{agent.command}</p>
      <p className="text-xs text-muted-foreground/60 pl-0.5 tabular">{agent.elapsed}</p>
    </div>
  );
}

// ─── Session tool config ──────────────────────────────────────────────────────

const SESSION_TOOL_CONFIG = {
  codex: {
    label: 'Codex',
    icon: Terminal,
    iconBg: 'bg-green-500/10',
    iconText: 'text-green-400',
    liveBorder: 'border-green-500/40 hover:border-green-500/60',
    hoverText: 'text-green-400',
    sectionAccent: 'text-green-400',
  },
  'claude-code': {
    label: 'Claude Code',
    icon: Bot,
    iconBg: 'bg-orange-500/10',
    iconText: 'text-orange-400',
    liveBorder: 'border-orange-500/40 hover:border-orange-500/60',
    hoverText: 'text-orange-400',
    sectionAccent: 'text-orange-400',
  },
  gemini: {
    label: 'Gemini CLI',
    icon: Sparkles,
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-400',
    liveBorder: 'border-blue-500/40 hover:border-blue-500/60',
    hoverText: 'text-blue-400',
    sectionAccent: 'text-blue-400',
  },
} as const;

// ─── Codex session card ───────────────────────────────────────────────────────

const LIVE_THRESHOLD_MS = 60_000;

function CodexSessionCard({ session, onClick }: { session: CodexSession; onClick: () => void }) {
  const turns = session.steps.filter(s => s.type === 'user_message').length;
  const toolCalls = session.steps.filter(s => s.type === 'function_call').length;
  const live = Date.now() - new Date(session.lastModifiedAt).getTime() < LIVE_THRESHOLD_MS;
  const d = new Date(session.startedAt);
  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const toolCfg = SESSION_TOOL_CONFIG[session.tool] ?? SESSION_TOOL_CONFIG.codex;
  const ToolIcon = toolCfg.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card/50 backdrop-blur-sm p-4',
        'flex flex-col gap-3 cursor-pointer transition-all duration-200 group',
        live
          ? cn(toolCfg.liveBorder, 'hover:bg-card/70')
          : 'border-border/50 hover:border-border hover:bg-card/70',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-md shrink-0', toolCfg.iconBg)}>
          <ToolIcon className={cn('h-3.5 w-3.5', toolCfg.iconText)} />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground/90">{toolCfg.label}</span>
        {/* Initiator badge */}
        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded-md',
          session.initiator === 'agent'
            ? 'bg-orange-500/10 text-orange-400'
            : 'bg-blue-500/10 text-blue-400',
        )}>
          {session.initiator === 'agent' ? 'Agent' : 'User'}
        </span>
        {live ? (
          <span className={cn('flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md', toolCfg.iconBg, toolCfg.iconText)}>
            <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', toolCfg.iconText.replace('text-', 'bg-'))} />
            LIVE
          </span>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="tabular">{dateStr} {timeStr}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-0.5">
        {session.prompt || '(no prompt)'}
      </p>
      <div className="flex items-center justify-between pl-0.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {turns} {turns === 1 ? 'turn' : 'turns'}
          </span>
          <span>{toolCalls} tool calls</span>
        </div>
        <span className={cn('text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity', toolCfg.hoverText)}>
          View →
        </span>
      </div>
    </div>
  );
}

// ─── OpenClaw agent card ──────────────────────────────────────────────────────

// Maps agent id → running process type in data.coding
const AGENT_CODING_TYPE: Record<string, string> = {
  codex:        'Codex',
  'claude-code': 'CC',
};

function OpenClawAgentCard({
  agent,
  isRunning,
  sessionCount,
  onViewSessions,
}: {
  agent: OpenClawAgent;
  isRunning: boolean;
  sessionCount: number;
  onViewSessions?: () => void;
}) {
  const clickable = !!onViewSessions;

  return (
    <div
      onClick={clickable ? onViewSessions : undefined}
      className={cn(
        'rounded-xl border bg-card/50 backdrop-blur-sm p-4',
        'flex flex-col gap-2.5 transition-all duration-200',
        isRunning  ? 'border-green-500/30' : 'border-border/50',
        clickable  ? 'cursor-pointer hover:border-border hover:bg-card/70 group' : '',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'flex items-center justify-center h-7 w-7 rounded-md shrink-0 text-base leading-none',
          isRunning ? 'bg-green-500/10' : 'bg-muted/40',
        )}>
          {agent.emoji ?? <Layers className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <span className="flex-1 text-sm font-semibold truncate">{agent.name}</span>
        {isRunning ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Running
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50 px-2 py-0.5 rounded-md border border-border/30">
            Idle
          </span>
        )}
      </div>

      {/* Model */}
      <p className="text-xs text-muted-foreground/60 pl-0.5 truncate">{shortModel(agent.model)}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pl-0.5">
        <span className="text-xs text-muted-foreground/50">
          {sessionCount > 0 ? `${sessionCount} session${sessionCount !== 1 ? 's' : ''}` : 'No sessions'}
        </span>
        {clickable && (
          <span className="text-xs text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View sessions →
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible session section ─────────────────────────────────────────────

type SessionTool = 'codex' | 'claude-code' | 'gemini';

function CollapsibleSessionSection({
  tool, sessions, open, onToggle, onOpenSession,
}: {
  tool: SessionTool;
  sessions: CodexSession[];
  open: boolean;
  onToggle: () => void;
  onOpenSession: (s: CodexSession) => void;
}) {
  const cfg = SESSION_TOOL_CONFIG[tool];
  const Icon = cfg.icon;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-6 w-6 rounded-md shrink-0', cfg.iconBg)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.iconText)} />
          </div>
          <h2 className="text-sm font-semibold text-foreground/80">{cfg.label} Sessions</h2>
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-md', cfg.iconBg, cfg.iconText)}>
            {sessions.length}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
      {open && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map(session => (
            <CodexSessionCard
              key={session.filePath}
              session={session}
              onClick={() => onOpenSession(session)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: number | string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 flex items-center gap-4">
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg shrink-0', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold tabular leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data } = useDashboardData();
  const [selected, setSelected] = useState<SubAgentData | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [codexInitial, setCodexInitial] = useState<CodexSession | null>(null);

  // Collapsible session section states
  const [codexSectionOpen, setCodexSectionOpen] = useState(true);
  const [claudeCodeSectionOpen, setClaudeCodeSectionOpen] = useState(true);
  const [geminiSectionOpen, setGeminiSectionOpen] = useState(true);

  const running  = data.agents.filter(a => a.status === 'running');
  const complete = data.agents.filter(a => a.status === 'complete');
  const failed   = data.agents.filter(a => a.status === 'failed');

  // Split sessions by tool
  const codexSessions     = data.codex.filter(s => s.tool === 'codex');
  const claudeCodeSessions = data.codex.filter(s => s.tool === 'claude-code');
  const geminiSessions    = data.codex.filter(s => s.tool === 'gemini');

  function openCodex(session: CodexSession) {
    setCodexInitial(session);
    setCodexOpen(true);
  }

  // Non-default agents only (exclude main)
  const subAgents = data.openclawAgents.filter(a => !a.isDefault);

  return (
    <div className="space-y-8 py-7">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Running"  value={running.length}          icon={Activity}     accent="bg-green-500/10 text-green-400" />
        <KpiCard label="Complete" value={complete.length}         icon={CheckCircle2} accent="bg-slate-500/10 text-slate-400" />
        <KpiCard label="Failed"   value={failed.length}           icon={XCircle}      accent="bg-red-500/10 text-red-400" />
        <KpiCard label="CPU"      value={data.stats ? `${data.stats.cpu.percent}%` : '—'} icon={Cpu} accent="bg-blue-500/10 text-blue-400" />
      </div>

      {/* Live coding processes */}
      {data.coding.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground/80">Coding Agents</h2>
            <span className="text-xs text-muted-foreground">{data.coding.length} running</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.coding.map(agent => (
              <CodingAgentCard key={agent.pid} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* Codex sessions */}
      {codexSessions.length > 0 && (
        <CollapsibleSessionSection
          tool="codex"
          sessions={codexSessions}
          open={codexSectionOpen}
          onToggle={() => setCodexSectionOpen(o => !o)}
          onOpenSession={openCodex}
        />
      )}

      {/* Claude Code sessions */}
      {claudeCodeSessions.length > 0 && (
        <CollapsibleSessionSection
          tool="claude-code"
          sessions={claudeCodeSessions}
          open={claudeCodeSectionOpen}
          onToggle={() => setClaudeCodeSectionOpen(o => !o)}
          onOpenSession={openCodex}
        />
      )}

      {/* Gemini CLI sessions */}
      {geminiSessions.length > 0 && (
        <CollapsibleSessionSection
          tool="gemini"
          sessions={geminiSessions}
          open={geminiSectionOpen}
          onToggle={() => setGeminiSectionOpen(o => !o)}
          onOpenSession={openCodex}
        />
      )}

      {/* OpenClaw sub-agents */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground/80">Sub-Agent Sessions</h2>
          {running.length > 0 && (
            <span className="text-xs text-muted-foreground">{running.length} active</span>
          )}
        </div>

        {subAgents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subAgents.map(agent => {
              const codingType = AGENT_CODING_TYPE[agent.id];
              const isRunning = codingType
                ? data.coding.some(c => c.type === codingType)
                : false;

              // Sessions from data.agents that belong to this agent
              // (currently main agent sessions only — future: per-agent sessions)
              const agentSessions = agent.isDefault
                ? running
                : [];

              return (
                <OpenClawAgentCard
                  key={agent.id}
                  agent={agent}
                  isRunning={isRunning}
                  sessionCount={agentSessions.length}
                  onViewSessions={agentSessions.length > 0
                    ? () => setSelected(agentSessions[0])
                    : undefined}
                />
              );
            })}

            {/* Active main-agent sessions (sub-agent JSONL) */}
            {running.map(agent => (
              <AgentCard key={agent.filePath} agent={agent} onClick={() => setSelected(agent)} />
            ))}
          </div>
        ) : (
          /* Fallback: no agents configured */
          running.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {running.map(agent => (
                <AgentCard key={agent.filePath} agent={agent} onClick={() => setSelected(agent)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12
                            rounded-xl border border-dashed border-border/40
                            text-muted-foreground">
              <Layers className="h-7 w-7 mb-3 opacity-25" />
              <p className="text-sm">No agents configured</p>
              <p className="text-xs mt-1 opacity-50">Run <code className="font-mono">openclaw agents add</code> to create one</p>
            </div>
          )
        )}
      </section>

      {/* System resources */}
      {data.stats && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/80 mb-4">System Resources</h2>
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 space-y-5">
            <ResourceBar label="CPU"    percent={data.stats.cpu.percent}  detail={`${data.stats.cpu.cores} cores`} />
            <ResourceBar label="Memory" percent={data.stats.mem.percent}  detail={`${data.stats.mem.usedGB}/${data.stats.mem.totalGB} GB`} />
            <ResourceBar label="Disk"   percent={data.stats.disk.percent} detail={`${data.stats.disk.usedGB}/${data.stats.disk.totalGB} GB`} />
            {data.stats.gpu && (
              <ResourceBar label="GPU" percent={data.stats.gpu.percent} detail={data.stats.gpu.name} />
            )}
          </div>
        </section>
      )}

      <AgentDrawer agent={selected} onClose={() => setSelected(null)} />
      {codexOpen && (
        <CodexDrawer
          sessions={data.codex}
          initialSession={codexInitial}
          onClose={() => { setCodexOpen(false); setCodexInitial(null); }}
        />
      )}
    </div>
  );
}
