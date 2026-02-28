'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusDot } from './StatusDot';
import { formatElapsed } from '@/lib/format';
import { Wrench, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubAgentData } from '../../server/types';

interface Props {
  agent: SubAgentData | null;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  running:  'bg-green-500/10 text-green-400 border-green-500/20',
  complete: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  failed:   'bg-red-500/10  text-red-400  border-red-500/20',
};

export function AgentDrawer({ agent, onClose }: Props) {
  return (
    <Sheet open={!!agent} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="bottom"
        className={cn(
          'glass border-border/50',
          'lg:!inset-y-0 lg:right-0 lg:!left-auto lg:!w-[400px] lg:rounded-none',
          'rounded-t-2xl',
        )}
      >
        {agent && (
          <div className="flex flex-col h-full">
            <SheetHeader className="pb-4 border-b border-border/40">
              <div className="flex items-start gap-3 pr-8">
                <StatusDot status={agent.status} live className="mt-1" />
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-left text-base font-semibold leading-tight">
                    {agent.label}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-md border',
                      STATUS_BADGE[agent.status],
                    )}>
                      {agent.status}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatElapsed(agent.elapsed)}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto space-y-5 py-5">
              {/* Recent tools */}
              {agent.recentTools.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Tools
                  </p>
                  <ol className="space-y-1.5">
                    {agent.recentTools.map((t, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm py-1.5 px-3
                                              rounded-lg bg-muted/30 border border-border/30">
                        <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                        <span className="text-xs text-foreground/80 break-all">{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Error details */}
              {agent.errorDetails && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Error
                  </p>
                  <p className="text-xs text-red-300/80 leading-relaxed break-all">
                    {agent.errorDetails}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
