import type { DashboardStat } from '../domain/stats';
import type { DashboardRepository } from '../application/DashboardRepository';

/** ponytail: static figures matching the device seed. Wire to real aggregates when a backend exists. */
export class InMemoryDashboardRepository implements DashboardRepository {
  async getStats(): Promise<DashboardStat[]> {
    await new Promise((r) => setTimeout(r, 250));
    return [
      { key: 'total', label: 'Tổng thiết bị', value: 128, hint: '+12 trong tháng', tone: 'blue' },
      { key: 'allocated', label: 'Đã cấp phát', value: 86, hint: '67% tổng số', tone: 'green' },
      { key: 'in-stock', label: 'Trong kho', value: 34, hint: 'Sẵn sàng cấp phát', tone: 'purple' },
      { key: 'disposal', label: 'Chờ thanh lý', value: 8, hint: 'Cần xử lý', tone: 'orange' },
    ];
  }
}
