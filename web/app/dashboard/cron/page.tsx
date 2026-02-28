'use client';
import { useDashboardData } from '@/hooks/useDashboardData';
import { CronTable } from '@/components/CronTable';

export default function CronPage() {
  const { data } = useDashboardData();
  return (
    <div className="space-y-6 py-6">
      <CronTable title="OpenClaw Cron Jobs" jobs={data.cron} />
      <CronTable title="System Cron Jobs"   jobs={data.syscron} />
      {data.cron.length === 0 && data.syscron.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No cron jobs detected.</p>
      )}
    </div>
  );
}
