import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateTransfer, canDecideTransfer } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { TRANSFER_STATUS, type DeviceTransfer, type TransferStatus } from '../domain/deviceTransfer';
import { deviceTransferService } from '../infrastructure/container';
import { useDeviceTransfers } from './useDeviceTransfers';
import { TRANSFER_STATUS_TONE } from './transferStatusTone';

export function DeviceTransferListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canCreate = canCreateTransfer(session);
  const canDecide = canDecideTransfer(session);
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const { data: transfers, loading, error } = useDeviceTransfers(
    { status: status || undefined },
    reloadKey,
  );

  const approve = useAsyncAction(async (t: DeviceTransfer) => {
    if (!window.confirm('Duyệt lệnh điều chuyển này?')) return;
    await deviceTransferService.approve(t.id);
    setReloadKey((k) => k + 1);
  });

  const reject = useAsyncAction(async (t: DeviceTransfer) => {
    const reason = window.prompt('Lý do từ chối');
    if (!reason || !reason.trim()) return;
    await deviceTransferService.reject(t.id, reason.trim());
    setReloadKey((k) => k + 1);
  });

  const print = useAsyncAction(async (t: DeviceTransfer) => {
    const detail = await deviceTransferService.get(t.id);
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(detail);
  });

  const columns: Array<Column<DeviceTransfer>> = [
    { key: 'from', header: 'Người giao', cell: (t) => t.fromUser.fullName },
    { key: 'to', header: 'Người nhận', cell: (t) => t.toUser.fullName },
    { key: 'count', header: 'Số thiết bị', cell: (t) => String(t.deviceCount), align: 'right' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (t) => <Badge tone={TRANSFER_STATUS_TONE[t.status]}>{t.status}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày tạo', cell: (t) => t.createdAt.slice(0, 10) },
    { key: 'createdBy', header: 'Người tạo', cell: (t) => t.createdBy.fullName },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (t) => (
        <div className="flex justify-end gap-2">
          {canDecide && t.status === TRANSFER_STATUS.PENDING && (
            <>
              <Button size="sm" variant="outline" disabled={approve.pending} onClick={() => void approve.run(t)}>
                Duyệt
              </Button>
              <Button size="sm" variant="outline" disabled={reject.pending} onClick={() => void reject.run(t)}>
                Từ chối
              </Button>
            </>
          )}
          {t.status === TRANSFER_STATUS.APPROVED && (
            <Button size="sm" variant="outline" disabled={print.pending} onClick={() => void print.run(t)}>
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
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Điều chuyển' }]}
        title="Điều chuyển"
        actions={
          canCreate && (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/transfers/new')}>
              Tạo lệnh
            </Button>
          )
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select className="sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as TransferStatus | '')}>
            <option value="">Trạng thái (Tất cả)</option>
            <option value={TRANSFER_STATUS.PENDING}>{TRANSFER_STATUS.PENDING}</option>
            <option value={TRANSFER_STATUS.APPROVED}>{TRANSFER_STATUS.APPROVED}</option>
            <option value={TRANSFER_STATUS.REJECTED}>{TRANSFER_STATUS.REJECTED}</option>
          </Select>
        </div>

        {(approve.error ?? reject.error ?? print.error ?? error) && (
          <p className="mb-3 text-sm text-status-dangerFg">
            {approve.error ?? reject.error ?? print.error ?? error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={transfers ?? []}
          rowKey={(t) => String(t.id)}
          empty={loading ? 'Đang tải…' : 'Không có lệnh nào'}
        />
      </Card>
    </>
  );
}
