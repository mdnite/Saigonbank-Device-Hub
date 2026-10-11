import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { DecisionInfo } from '@/shared/ui/DecisionInfo';
import { Modal } from '@/shared/ui/Modal';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { ORDER_STATUS, type DeviceOrderDetail } from '../domain/deviceOrder';
import { deviceOrderService } from '../infrastructure/container';
import { ORDER_STATUS_TONE } from './orderStatusTone';

type Item = DeviceOrderDetail['items'][number];

const ITEM_COLUMNS: Array<Column<Item>> = [
  { key: 'code', header: 'Mã', cell: (i) => i.device.deviceCode },
  { key: 'name', header: 'Tên', cell: (i) => i.device.deviceName },
  { key: 'type', header: 'Loại', cell: (i) => i.device.deviceType.typeName },
  { key: 'serial', header: 'Serial', cell: (i) => i.device.serialNumber ?? '—' },
];

/** Xem chi tiết 1 đơn: thông tin chung, người tạo/duyệt, lý do từ chối, danh sách thiết bị. */
export function OrderDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, loading, error } = useAsyncData<DeviceOrderDetail | null>(
    () => (id === null ? Promise.resolve(null) : deviceOrderService.get(id)),
    [id],
  );
  const print = useAsyncAction(async (d: DeviceOrderDetail) => {
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(d);
  });

  return (
    <Modal
      open={id !== null}
      title={`Chi tiết đơn #${id ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {data?.status === ORDER_STATUS.APPROVED && (
            <Button variant="outline" disabled={print.pending} onClick={() => void print.run(data)}>
              In biên bản
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-ink-muted">Đang tải…</p>
      ) : error || !data ? (
        <p className="text-sm text-status-dangerFg">{error ?? 'Không tải được đơn'}</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Loại</dt>
              <dd className="font-medium text-ink">{data.type}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Trạng thái</dt>
              <dd>
                <Badge tone={ORDER_STATUS_TONE[data.status]}>{data.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Người liên quan</dt>
              <dd className="font-medium text-ink">{data.targetUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Ghi chú</dt>
              <dd className="text-ink">{data.note || '—'}</dd>
            </div>
          </dl>
          <DecisionInfo
            createdBy={data.createdBy}
            createdAt={data.createdAt}
            decidedBy={data.decidedBy}
            decidedAt={data.decidedAt}
            rejectReason={data.rejectReason}
          />
          <DataTable columns={ITEM_COLUMNS} rows={data.items} rowKey={(i) => String(i.id)} />
          {print.error && <p className="text-sm text-status-dangerFg">{print.error}</p>}
        </div>
      )}
    </Modal>
  );
}
