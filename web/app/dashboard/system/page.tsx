'use client';
import { useDashboardData } from '@/hooks/useDashboardData';
import { ResourceBar } from '@/components/ResourceBar';
import { formatBytes } from '@/lib/format';
import { Container, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SystemPage() {
  const { data } = useDashboardData();
  const { stats } = data;

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary
                          animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading system data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-7">

      {/* Resource meters */}
      <section>
        <h2 className="text-sm font-semibold text-foreground/80 mb-4">Resources</h2>
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 space-y-6">
          <ResourceBar label="CPU"    percent={stats.cpu.percent}  detail={`${stats.cpu.cores} cores`} />
          <ResourceBar label="Memory" percent={stats.mem.percent}  detail={`${formatBytes(stats.mem.usedGB)} / ${formatBytes(stats.mem.totalGB)}`} />
          <ResourceBar label="Disk"   percent={stats.disk.percent} detail={`${formatBytes(stats.disk.usedGB)} / ${formatBytes(stats.disk.totalGB)}`} />
          {stats.gpu && (
            <ResourceBar label="GPU" percent={stats.gpu.percent}
              detail={`${stats.gpu.name} · ${stats.gpu.memUsedMB}/${stats.gpu.memTotalMB} MB`} />
          )}
        </div>
      </section>

      {/* Containers & Pods */}
      <section>
        <h2 className="text-sm font-semibold text-foreground/80 mb-4">
          Containers & Pods
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({stats.containers.length})
          </span>
        </h2>
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
          {stats.containers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Boxes className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm">No containers detected</p>
              <p className="text-xs mt-1 opacity-60">Docker and Kubernetes pods will appear here</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {stats.containers.map((c, i) => (
                <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-center h-7 w-7 rounded-md
                                  bg-blue-500/10 shrink-0">
                    <Container className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.image || c.source}</p>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-md shrink-0',
                    c.source === 'docker'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-purple-500/10 text-purple-400',
                  )}>
                    {c.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
