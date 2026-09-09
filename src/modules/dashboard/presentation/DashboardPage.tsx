import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DashboardStat, StatTone } from '../domain/stats';
import { dashboardService } from '../infrastructure/container';

const TONE_BG: Record<StatTone, string> = {
  blue: 'bg-card-blue',
  green: 'bg-card-green',
  purple: 'bg-card-purple',
  orange: 'bg-card-orange',
};

function StatCard({ stat }: { stat: DashboardStat }) {
  return (
    <div
      className={cn(
        'flex min-h-[112px] flex-col justify-between rounded-xl p-5',
        TONE_BG[stat.tone],
      )}
    >
      <span className="text-sm font-medium text-ink-muted">{stat.label}</span>
      <span className="text-3xl font-bold text-ink">{stat.value}</span>
      {stat.hint && <span className="text-xs text-ink-muted">{stat.hint}</span>}
    </div>
  );
}

export function DashboardPage() {
  const { data: stats, loading } = useAsyncData(() => dashboardService.getStats(), []);

  return (
    <>
      <PageHeader title="Dashboard" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Chào mừng quay lại! Đây là tình hình thiết bị của bạn.
      </p>

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading || !stats
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="min-h-[112px] animate-pulse rounded-xl bg-surface-sunken" />
              ))
            : stats.map((stat) => <StatCard key={stat.key} stat={stat} />)}
        </div>
      </Card>
    </>
  );
}
