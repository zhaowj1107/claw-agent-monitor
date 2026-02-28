'use client';
import { cn } from '@/lib/utils';
import { StatusDot } from './StatusDot';
import { formatElapsed, truncate } from '@/lib/format';
import { Wrench } from 'lucide-react';
import type { SubAgentData } from '../../server/types';

interface Props {
  agent: SubAgentData;
  onClick: () => void;
}

const STATUS_BORDER: Record<string, string> = {
  running:  'border-l-green-500/60',
  complete: 'border-l-slate-500/40',
  failed:   'border-l-red-500/60',
};

export function AgentCard({ agent, onClick }: Props) {
  const { label, status, elapsed, currentTool, toolArgs, toolCount } = agent;

  const toolDetail = status === 'running' && currentTool
    ? `${currentTool}${toolArgs ? `: ${toolArgs}` : ''}`
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        // base
        'group w-full text-left rounded-xl cursor-pointer',
        'border-l-2 border border-border/50 bg-card/50',
        'backdrop-blur-sm p-4',
        // layout
        'flex flex-col gap-2.5',
        // interaction
        'transition-all duration-200',
        'hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/20',
        'hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        // status left border
        STATUS_BORDER[status],
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <StatusDot status={status} live />
        <span className="flex-1 text-sm font-semibold truncate leading-tight">
          {truncate(label, 40)}
        </span>
        <span className={cn(
          'text-xs tabular shrink-0 font-medium px-2 py-0.5 rounded-md',
          status === 'running'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-muted text-muted-foreground',
        )}>
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-h-[18px]">
        {toolDetail ? (
          <>
            <Wrench className="h-3 w-3 shrink-0 text-primary/60" />
            <span className="truncate">{toolDetail}</span>
          </>
        ) : (
          <>
            <Wrench className="h-3 w-3 shrink-0" />
            <span>{toolCount} tool call{toolCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
    </button>
  );
}
