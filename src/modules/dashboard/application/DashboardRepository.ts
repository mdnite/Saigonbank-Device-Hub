import type { DashboardStat } from '../domain/stats';

export interface DashboardRepository {
  getStats(): Promise<DashboardStat[]>;
}

export function makeDashboardService(repo: DashboardRepository) {
  return {
    getStats: () => repo.getStats(),
  };
}

export type DashboardService = ReturnType<typeof makeDashboardService>;
