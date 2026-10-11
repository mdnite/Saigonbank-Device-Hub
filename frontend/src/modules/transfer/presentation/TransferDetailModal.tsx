import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { DecisionInfo } from '@/shared/ui/DecisionInfo';
import { Modal } from '@/shared/ui/Modal';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { TRANSFER_STATUS, type DeviceTransferDetail } from '../domain/deviceTransfer';
import { deviceTransferService } from '../infrastructure/container';
import { TRANSFER_STATUS_TONE } from './transferStatusTone';

type Item = DeviceTransferDetail['items'][number];

const ITEM_COLUMNS: Array<Column<Item>> = [
  { key: 'code', header: 'Mã', cell: (i) => i.device.deviceCode },
  { key: 'name', header: 'Tên', cell: (i) => i.device.deviceName },
  { key: 'type', header: 'Loại', cell: (i) => i.device.deviceType.typeName },
  { key: 'serial', header: 'Serial', cell: (i) => i.device.serialNumber ?? '—' },
];

/** Xem chi tiết 1 lệnh điều chuyển: người giao → nhận, người tạo/duyệt, lý do từ chối, thiết bị. */
export function TransferDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, loading, error } = useAsyncData<DeviceTransferDetail | null>(
    () => (id === null ? Promise.resolve(null) : deviceTransferService.get(id)),
    [id],
  );
  const print = useAsyncAction(async (d: DeviceTransferDetail) => {
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(d);
  });

  return (
    <Modal
      open={id !== null}
      title={`Chi tiết lệnh điều chuyển #${id ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {data?.status === TRANSFER_STATUS.APPROVED && (
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
        <p className="text-sm text-status-dangerFg">{error ?? 'Không tải được lệnh'}</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Người giao</dt>
              <dd className="font-medium text-ink">{data.fromUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Người nhận</dt>
              <dd className="font-medium text-ink">{data.toUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Trạng thái</dt>
              <dd>
                <Badge tone={TRANSFER_STATUS_TONE[data.status]}>{data.status}</Badge>
              </dd>
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
