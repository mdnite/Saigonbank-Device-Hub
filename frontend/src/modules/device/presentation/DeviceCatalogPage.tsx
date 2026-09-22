import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, MoreVertical, Plus, Upload } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canWriteDevices } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { DEVICE_STATUS_OPTIONS, type Device, type DeviceStatus } from '../domain/device';
import type { DeviceQuery } from '../application/DeviceRepository';
import { deviceService } from '../infrastructure/container';
import { useDevices } from './useDevices';
import { STATUS_TONE } from './statusTone';

const ICON_BTN = 'rounded p-1 hover:bg-surface-sunken disabled:opacity-40';

export function DeviceCatalogPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canWrite = canWriteDevices(session);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeviceStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const query: DeviceQuery = { search, status: status || undefined };
  const { data: devices, loading } = useDevices(query, reloadKey);

  const del = useAsyncAction(async (d: Device) => {
    // ponytail: confirm native của trình duyệt — đổi sang Modal khi shared/ui có.
    if (!window.confirm(`Xoá thiết bị ${d.deviceCode}?`)) return;
    await deviceService.remove(d.id);
    setReloadKey((k) => k + 1);
  });

  const columns: Array<Column<Device>> = [
    {
      key: 'deviceCode',
      header: 'Mã thiết bị',
      cell: (d) => <span className="font-medium">{d.deviceCode}</span>,
    },
    { key: 'deviceName', header: 'Tên thiết bị', cell: (d) => d.deviceName },
    {
      key: 'spec',
      header: 'Cấu hình chi tiết',
      cell: (d) => <span className="text-ink-muted">{d.specDetail}</span>,
    },
    { key: 'owner', header: 'Người sở hữu', cell: (d) => d.currentUser?.fullName ?? '—' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (d) =>
        !canWrite ? null : (
          <div className="flex justify-end gap-1 text-ink-muted">
            <button
              type="button"
              className={ICON_BTN}
              disabled={del.pending}
              aria-label="Xoá thiết bị"
              title="Xoá thiết bị"
              onClick={() => void del.run(d)}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={ICON_BTN}
              aria-label="Xem chi tiết"
              title="Xem chi tiết"
              onClick={() => navigate(`/devices/${d.id}/edit`)}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Thiết bị' }]}
        title="Danh mục thiết bị"
        actions={
          <>
            <Button variant="outline" size="sm" aria-label="Xuất dữ liệu">
              <Upload className="h-4 w-4" />
            </Button>
            {canWrite && (
              <Button
                size="sm"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/devices/new')}
              >
                Thêm thiết bị
              </Button>
            )}
          </>
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            placeholder="Tìm kiếm theo mã hoặc tên thiết bị"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            className="sm:w-56"
            value={status}
            onChange={(e) => setStatus(e.target.value as DeviceStatus | '')}
          >
            <option value="">Trạng thái (Tất cả)</option>
            {DEVICE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        {del.error && <p className="mb-3 text-sm text-status-dangerFg">{del.error}</p>}

        <DataTable
          columns={columns}
          rows={devices ?? []}
          rowKey={(d) => String(d.id)}
          empty={loading ? 'Đang tải…' : 'Không tìm thấy thiết bị nào'}
        />
      </Card>
    </>
  );
}
