'use client';
import { Wifi, WifiOff } from 'lucide-react';
import type { ConnectionState } from '@/hooks/useWebSocket';

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === 'connected') return null;

  const isConnecting = state === 'connecting';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2
                 py-1.5 px-4 text-xs font-medium
                 bg-amber-500/10 border-b border-amber-500/20 text-amber-400
                 backdrop-blur-sm"
    >
      {isConnecting
        ? <Wifi className="h-3.5 w-3.5 animate-pulse" />
        : <WifiOff className="h-3.5 w-3.5" />
      }
      {isConnecting ? 'Connecting to server…' : 'Disconnected — reconnecting…'}
    </div>
  );
}
