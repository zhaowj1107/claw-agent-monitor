'use client';
import { useEffect, useRef, useState } from 'react';
import {
  X, Terminal, Cpu, MessageSquare, Wrench,
  ChevronRight, ChevronLeft, ChevronDown, Bot, Zap, Clock, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CodexSession, CodexStep, CodexStepType } from '../../server/types';

// ─── Tool config ──────────────────────────────────────────────────────────────

const TOOL_CONFIG = {
  codex: {
    label: 'Codex Session',
    icon: Terminal,
    iconBg: 'bg-green-500/10',
    iconText: 'text-green-400',
  },
  'claude-code': {
    label: 'Claude Code Session',
    icon: Bot,
    iconBg: 'bg-orange-500/10',
    iconText: 'text-orange-400',
  },
  gemini: {
    label: 'Gemini CLI Session',
    icon: Sparkles,
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-400',
  },
} as const;

interface Props {
  sessions: CodexSession[];
  initialSession: CodexSession | null;
  onClose: () => void;
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, '0')}m`;
}

// ─── Filter definitions ───────────────────────────────────────────────────────

type FilterKey = 'reasoning' | 'reply' | 'action' | 'toolcall';

const FILTER_DEFS: {
  key: FilterKey;
  label: string;
  icon: React.ElementType;
  activeClass: string;
  types: CodexStepType[];
}[] = [
  {
    key: 'reasoning',
    label: 'Reasoning',
    icon: Cpu,
    activeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    types: ['agent_reasoning'],
  },
  {
    key: 'reply',
    label: 'Output',
    icon: Bot,
    activeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    types: ['assistant_message'],
  },
  {
    key: 'action',
    label: 'Action',
    icon: Zap,
    activeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    types: ['agent_message'],
  },
  {
    key: 'toolcall',
    label: 'Tool Call',
    icon: Wrench,
    activeClass: 'bg-green-500/15 text-green-400 border-green-500/30',
    types: ['function_call', 'function_call_output'],
  },
];

const ALL_FILTER_KEYS = new Set<FilterKey>(['reasoning', 'reply', 'action', 'toolcall']);

// ─── Step row ────────────────────────────────────────────────────────────────

function StepRow({ step, turnIndex }: { step: CodexStep; turnIndex?: number }) {
  const [collapsed, setCollapsed] = useState(false);

  if (step.type === 'user_message') {
    return (
      <div className="flex gap-3 pt-5 pb-3 border-b border-border/30">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-500/10 shrink-0 mt-0.5">
          <MessageSquare className="h-3 w-3 text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-400 mb-1">
            Prompt{turnIndex !== undefined ? ` · Turn ${turnIndex + 1}` : ''}
          </p>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{step.text}</p>
        </div>
      </div>
    );
  }

  if (step.type === 'agent_reasoning') {
    return (
      <div className="flex gap-3 py-2.5 border-b border-border/20">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-purple-500/10 shrink-0 mt-0.5">
          <Cpu className="h-3 w-3 text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1 text-xs font-medium text-purple-400 mb-1 cursor-pointer"
          >
            Reasoning
            <ChevronDown className={cn('h-3 w-3 transition-transform', collapsed && '-rotate-90')} />
          </button>
          {!collapsed && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
              {step.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'agent_message') {
    return (
      <div className="flex gap-3 py-2.5 border-b border-border/20">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-sky-500/10 shrink-0 mt-0.5">
          <Zap className="h-3 w-3 text-sky-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-sky-400 mb-1">Action</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
            {step.text}
          </p>
        </div>
      </div>
    );
  }

  if (step.type === 'assistant_message') {
    return (
      <div className="flex gap-3 py-3 border-b border-border/30 bg-accent/5 -mx-5 px-5">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-violet-500/10 shrink-0 mt-0.5">
          <Bot className="h-3 w-3 text-violet-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-violet-400 mb-1">Reply</p>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
            {step.text}
          </p>
        </div>
      </div>
    );
  }

  if (step.type === 'function_call') {
    let argsDisplay = step.arguments ?? '';
    try { argsDisplay = JSON.stringify(JSON.parse(argsDisplay), null, 2); } catch { /* keep raw */ }

    return (
      <div className="flex gap-3 py-2.5 border-b border-border/20">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-green-500/10 shrink-0 mt-0.5">
          <Wrench className="h-3 w-3 text-green-400" />
        </div>
        <div className="min-w-0 w-full">
          <p className="text-xs font-medium text-green-400 mb-1">
            Tool Call <span className="font-mono">{step.name}</span>
          </p>
          {argsDisplay && (
            <pre className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {argsDisplay}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'function_call_output') {
    const output = step.output ?? '';
    const lines = output.split('\n');
    const preview = lines.slice(0, 20).join('\n');
    const truncated = lines.length > 20;

    return (
      <div className="flex gap-3 py-2.5 border-b border-border/20">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-orange-500/10 shrink-0 mt-0.5">
          <ChevronRight className="h-3 w-3 text-orange-400" />
        </div>
        <div className="min-w-0 w-full">
          <p className="text-xs font-medium text-orange-400 mb-1">Output</p>
          <pre className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
            {preview}
            {truncated && <span className="text-muted-foreground/50">{'\n'}…{lines.length - 20} more lines</span>}
          </pre>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Session picker ───────────────────────────────────────────────────────────

function SessionPicker({
  sessions, current, onChange,
}: {
  sessions: CodexSession[];
  current: CodexSession;
  onChange: (s: CodexSession) => void;
}) {
  const [open, setOpen] = useState(false);

  const fmt = (s: CodexSession) => {
    const d = new Date(s.startedAt);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <span className="tabular">{fmt(current)}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-64
                          rounded-lg border border-border/50 bg-card/95 backdrop-blur-xl shadow-xl
                          overflow-hidden">
            {sessions.map((s, i) => (
              <button
                key={s.filePath}
                onClick={() => { onChange(s); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-xs flex flex-col gap-0.5',
                  'hover:bg-muted/50 transition-colors cursor-pointer',
                  s.filePath === current.filePath && 'bg-muted/30',
                )}
              >
                <span className={cn(
                  'font-medium tabular',
                  s.filePath === current.filePath ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {fmt(s)}
                  {i === 0 && <span className="ml-2 text-green-400 font-normal">latest</span>}
                </span>
                <span className="text-muted-foreground/70 truncate">{s.prompt.slice(0, 60)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

const LIVE_THRESHOLD_MS = 60_000;

function isLive(session: CodexSession): boolean {
  return Date.now() - new Date(session.lastModifiedAt).getTime() < LIVE_THRESHOLD_MS;
}

export function CodexDrawer({ sessions, initialSession, onClose }: Props) {
  const [current, setCurrent] = useState<CodexSession | null>(initialSession);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set(ALL_FILTER_KEYS));
  const [tick, setTick] = useState(0); // forces re-render every second when LIVE
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Sync when parent opens a new session
  useEffect(() => {
    if (initialSession) { setCurrent(initialSession); userScrolledUp.current = false; }
  }, [initialSession]);

  // Keep current in sync with live data for the same file
  useEffect(() => {
    if (!current) return;
    const updated = sessions.find(s => s.filePath === current.filePath);
    if (updated && updated.steps.length !== current.steps.length) {
      setCurrent(updated);
    }
  }, [sessions, current]);

  // Auto-scroll to bottom on new steps (only if user hasn't scrolled up)
  useEffect(() => {
    if (!current || userScrolledUp.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current?.steps.length, current]);

  // Tick every second while LIVE to keep duration display current
  useEffect(() => {
    if (!current || !isLive(current)) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [current?.filePath, current && isLive(current)]);

  // Track if user scrolled up manually
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distFromBottom > 80;
  };

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prev / next navigation
  const idx = sessions.findIndex(s => s.filePath === current?.filePath);
  const hasPrev = idx < sessions.length - 1;
  const hasNext = idx > 0;

  // Duration: live → elapsed since startedAt; finished → startedAt→lastModifiedAt
  const duration = current
    ? formatDuration(
        (isLive(current) ? Date.now() : new Date(current.lastModifiedAt).getTime())
        - new Date(current.startedAt).getTime()
      )
    : null;

  // Build the set of step types that are currently visible
  const visibleTypes = new Set<CodexStepType>(['user_message']);
  for (const def of FILTER_DEFS) {
    if (filters.has(def.key)) def.types.forEach(t => visibleTypes.add(t));
  }

  function toggleFilter(key: FilterKey) {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Annotate turn index onto user_message steps, then filter
  const stepsWithTurns = (current?.steps ?? [])
    .map((step, i, arr) => {
      const turnIndex = step.type === 'user_message'
        ? arr.slice(0, i + 1).filter(s => s.type === 'user_message').length - 1
        : undefined;
      return { step, turnIndex };
    })
    .filter(({ step }) => visibleTypes.has(step.type));

  // suppress tick warning — it's used to force re-render for duration display
  void tick;

  const open = !!current;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl',
          'flex flex-col',
          'bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-2xl',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border/50 shrink-0">
          {(() => {
            const toolCfg = current ? (TOOL_CONFIG[current.tool] ?? TOOL_CONFIG.codex) : TOOL_CONFIG.codex;
            const ToolIcon = toolCfg.icon;
            return (
              <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg mt-0.5', toolCfg.iconBg)}>
                <ToolIcon className={cn('h-4 w-4', toolCfg.iconText)} />
              </div>
            );
          })()}

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-sm font-semibold">
                {current ? (TOOL_CONFIG[current.tool] ?? TOOL_CONFIG.codex).label : 'Session'}
              </p>
              {/* Initiator badge */}
              {current && (
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-md',
                  current.initiator === 'agent'
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-blue-500/10 text-blue-400',
                )}>
                  {current.initiator === 'agent' ? 'Agent' : 'User'}
                </span>
              )}
              {current && isLive(current) && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-400
                                 bg-green-500/10 px-1.5 py-0.5 rounded-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
              {/* Duration */}
              {current && duration && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/70 tabular">
                  <Clock className="h-3 w-3 shrink-0" />
                  {duration}
                </span>
              )}
              {/* Turns + steps count */}
              {current && (
                <span className="text-xs text-muted-foreground/60 tabular">
                  {current.steps.filter(s => s.type === 'user_message').length} turns ·{' '}
                  {current.steps.length} steps
                </span>
              )}
            </div>
            {/* Session picker or date */}
            {current && sessions.length > 1 && (
              <SessionPicker sessions={sessions} current={current} onChange={setCurrent} />
            )}
            {current && sessions.length === 1 && (
              <p className="text-xs text-muted-foreground tabular">
                {new Date(current.startedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Prev / Next / Close */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => hasPrev && setCurrent(sessions[idx + 1])}
              disabled={!hasPrev}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
              aria-label="Older session"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => hasNext && setCurrent(sessions[idx - 1])}
              disabled={!hasNext}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
              aria-label="Newer session"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/30 shrink-0 overflow-x-auto">
          {FILTER_DEFS.map(def => {
            const active = filters.has(def.key);
            const Icon = def.icon;
            return (
              <button
                key={def.key}
                onClick={() => toggleFilter(def.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium',
                  'transition-all duration-150 cursor-pointer shrink-0',
                  active
                    ? def.activeClass
                    : 'border-border/30 text-muted-foreground/40 hover:text-muted-foreground hover:border-border/50',
                )}
              >
                <Icon className="h-3 w-3" />
                {def.label}
              </button>
            );
          })}
        </div>

        {/* Prompt summary bar */}
        {current?.prompt && (
          <div className="px-5 py-2.5 border-b border-border/30 bg-muted/20 shrink-0">
            <p className="text-xs text-muted-foreground/80 truncate italic">{current.prompt}</p>
          </div>
        )}

        {/* Steps */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 pb-6">
          {stepsWithTurns.map(({ step, turnIndex }, i) => (
            <StepRow key={i} step={step} turnIndex={turnIndex} />
          ))}
          {!current?.steps.length && (
            <p className="text-xs text-muted-foreground text-center mt-8">No steps recorded yet</p>
          )}
          {current?.steps.length && !stepsWithTurns.length && (
            <p className="text-xs text-muted-foreground text-center mt-8">
              All steps hidden — enable a filter above
            </p>
          )}
        </div>
      </div>
    </>
  );
}
