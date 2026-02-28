import { cn } from '@/lib/utils';

type Status = 'running' | 'complete' | 'failed';

const STYLE: Record<Status, string> = {
  running:  'bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.5)]',
  complete: 'bg-slate-500',
  failed:   'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.4)]',
};

interface Props {
  status: Status;
  live?: boolean;
  className?: string;
}

export function StatusDot({ status, live = false, className }: Props) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0 transition-shadow duration-300',
        STYLE[status],
        live && status === 'running' && 'animate-pulse motion-reduce:animate-none',
        className,
      )}
      aria-label={status}
      role="img"
    />
  );
}
