import { makeDashboardService } from '../application/DashboardRepository';
import { InMemoryDashboardRepository } from './InMemoryDashboardRepository';

export const dashboardService = makeDashboardService(new InMemoryDashboardRepository());
