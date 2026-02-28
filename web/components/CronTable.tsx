import { relativeTime } from '@/lib/format';
import { Clock } from 'lucide-react';
import type { CronJobData } from '../../server/types';

export function CronTable({ jobs, title }: { jobs: CronJobData[]; title: string }) {
  if (jobs.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground/80 mb-4">{title}</h2>
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Name / Schedule
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Next Run
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Last Run
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {jobs.map((job, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors duration-100">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-sm">{job.name || job.schedule}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 tabular">{job.schedule}</div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    {job.nextRun ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 text-primary/60" />
                        <span className="tabular">{relativeTime(job.nextRun)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground tabular">
                      {job.lastRun ? new Date(job.lastRun).toLocaleTimeString() : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
