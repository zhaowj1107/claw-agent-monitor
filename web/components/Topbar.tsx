'use client';
import { Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { StatusDot } from './StatusDot';
import { cn } from '@/lib/utils';

interface Props {
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

export function Topbar({ connectionState }: Props) {
  const isConnected = connectionState === 'connected';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14
                       border-b border-border/50
                       bg-background/70 backdrop-blur-xl
                       flex items-center px-4 gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Claw-AgentMonitor</span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Connection status pill */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'border transition-colors duration-300',
          isConnected
            ? 'bg-green-500/8 border-green-500/20 text-green-400'
            : 'bg-amber-500/8 border-amber-500/20 text-amber-400',
        )}>
          <StatusDot
            status={isConnected ? 'running' : 'failed'}
            live={isConnected}
          />
          {isConnected ? 'Live' : connectionState === 'connecting' ? 'Connecting' : 'Offline'}
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
