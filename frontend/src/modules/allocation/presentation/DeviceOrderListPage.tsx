import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateOrder, canDecideOrder } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { ORDER_STATUS, ORDER_TYPE, type DeviceOrder, type OrderStatus, type OrderType } from '../domain/deviceOrder';
import { deviceOrderService } from '../infrastructure/container';
import { downloadBienBan } from './print/generateBienBan';
import { useDeviceOrders } from './useDeviceOrders';
import { ORDER_STATUS_TONE } from './orderStatusTone';

export function DeviceOrderListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canCreate = canCreateOrder(session);
  const canDecide = canDecideOrder(session);
  const [type, setType] = useState<OrderType | ''>('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const { data: orders, loading, error } = useDeviceOrders(
    { type: type || undefined, status: status || undefined },
    reloadKey,
  );

  const approve = useAsyncAction(async (o: DeviceOrder) => {
    if (!window.confirm('Duyệt đơn này?')) return;
    await deviceOrderService.approve(o.id);
    setReloadKey((k) => k + 1);
  });

  const reject = useAsyncAction(async (o: DeviceOrder) => {
    const reason = window.prompt('Lý do từ chối');
    if (!reason || !reason.trim()) return;
    await deviceOrderService.reject(o.id, reason.trim());
    setReloadKey((k) => k + 1);
  });

  const print = useAsyncAction(async (o: DeviceOrder) => {
    const detail = await deviceOrderService.get(o.id);
    downloadBienBan(detail);
  });

  const columns: Array<Column<DeviceOrder>> = [
    { key: 'type', header: 'Loại', cell: (o) => o.type },
    { key: 'target', header: 'Người liên quan', cell: (o) => o.targetUser.fullName },
    { key: 'count', header: 'Số thiết bị', cell: (o) => String(o.deviceCount), align: 'right' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (o) => <Badge tone={ORDER_STATUS_TONE[o.status]}>{o.status}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày tạo', cell: (o) => o.createdAt.slice(0, 10) },
    { key: 'createdBy', header: 'Người tạo', cell: (o) => o.createdBy.fullName },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (o) => (
        <div className="flex justify-end gap-2">
          {canDecide && o.status === ORDER_STATUS.PENDING && (
            <>
              <Button size="sm" variant="outline" disabled={approve.pending} onClick={() => void approve.run(o)}>
                Duyệt
              </Button>
              <Button size="sm" variant="outline" disabled={reject.pending} onClick={() => void reject.run(o)}>
                Từ chối
              </Button>
            </>
          )}
          {o.status === ORDER_STATUS.APPROVED && (
            <Button size="sm" variant="outline" disabled={print.pending} onClick={() => void print.run(o)}>
              In biên bản
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Cấp phát - Thu hồi' }]}
        title="Cấp phát - Thu hồi"
        actions={
          canCreate && (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/allocation/new')}>
              Tạo đơn
            </Button>
          )
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select className="sm:w-56" value={type} onChange={(e) => setType(e.target.value as OrderType | '')}>
            <option value="">Loại (Tất cả)</option>
            <option value={ORDER_TYPE.ALLOCATE}>{ORDER_TYPE.ALLOCATE}</option>
            <option value={ORDER_TYPE.RECOVER}>{ORDER_TYPE.RECOVER}</option>
          </Select>
          <Select className="sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Trạng thái (Tất cả)</option>
            <option value={ORDER_STATUS.PENDING}>{ORDER_STATUS.PENDING}</option>
            <option value={ORDER_STATUS.APPROVED}>{ORDER_STATUS.APPROVED}</option>
            <option value={ORDER_STATUS.REJECTED}>{ORDER_STATUS.REJECTED}</option>
          </Select>
        </div>

        {(approve.error ?? reject.error ?? print.error ?? error) && (
          <p className="mb-3 text-sm text-status-dangerFg">
            {approve.error ?? reject.error ?? print.error ?? error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={orders ?? []}
          rowKey={(o) => String(o.id)}
          empty={loading ? 'Đang tải…' : 'Không có đơn nào'}
        />
      </Card>
    </>
  );
}
