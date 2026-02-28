import { cn } from '@/lib/utils';

interface ResourceBarProps {
  label: string;
  percent: number;
  detail?: string;
  warnAt?: number;
  critAt?: number;
}

export function ResourceBar({
  label,
  percent,
  detail,
  warnAt = 70,
  critAt = 90,
}: ResourceBarProps) {
  const p = Math.min(Math.max(percent, 0), 100);

  const barColor =
    p >= critAt ? 'bg-red-500'   :
    p >= warnAt ? 'bg-amber-500' :
                  'bg-green-500';

  const glowColor =
    p >= critAt ? 'shadow-[0_0_8px_rgba(239,68,68,0.4)]'    :
    p >= warnAt ? 'shadow-[0_0_8px_rgba(245,158,11,0.4)]'   :
                  'shadow-[0_0_8px_rgba(34,197,94,0.3)]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {detail && (
            <span className="text-xs text-muted-foreground/70 hidden sm:inline">{detail}</span>
          )}
          <span className={cn('text-xs font-semibold tabular', barColor.replace('bg-', 'text-'))}>
            {p}%
          </span>
        </div>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden"
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${p}%`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            barColor,
            glowColor,
          )}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
