import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, MoreVertical, Plus, Upload } from 'lucide-react';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import {
  DEVICE_STATUSES,
  DEVICE_STATUS_LABEL,
  specSummary,
  type Device,
} from '../domain/device';
import type { DeviceQuery } from '../application/DeviceRepository';
import { useDevices } from './useDevices';
import { STATUS_TONE } from './statusTone';

const COLUMNS: Array<Column<Device>> = [
  { key: 'id', header: 'Mã thiết bị', cell: (d) => <span className="font-medium">{d.id}</span> },
  { key: 'name', header: 'Tên thiết bị', cell: (d) => d.name },
  {
    key: 'spec',
    header: 'Cấu hình chi tiết',
    cell: (d) => <span className="text-ink-muted">{specSummary(d.spec)}</span>,
  },
  { key: 'owner', header: 'Người sở hữu', cell: (d) => d.owner ?? '—' },
  {
    key: 'status',
    header: 'Trạng thái',
    cell: (d) => <Badge tone={STATUS_TONE[d.status]}>{DEVICE_STATUS_LABEL[d.status]}</Badge>,
  },
  {
    key: 'actions',
    header: 'Hoạt động',
    align: 'right',
    cell: () => (
      <div className="flex justify-end gap-1 text-ink-muted">
        <button className="rounded p-1 hover:bg-surface-sunken" aria-label="Thêm thao tác">
          <MoreVertical className="h-4 w-4" />
        </button>
        <button className="rounded p-1 hover:bg-surface-sunken" aria-label="Xem chi tiết">
          <Eye className="h-4 w-4" />
        </button>
      </div>
    ),
  },
];

export function DeviceCatalogPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<DeviceQuery>({ search: '', status: 'ALL' });
  const { data: devices, loading } = useDevices(query);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Tài sản' }]}
        title="Danh mục thiết bị"
        actions={
          <>
            <Button variant="outline" size="sm" aria-label="Xuất dữ liệu">
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/devices/new')}
            >
              Thêm tài sản
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            placeholder="Tìm kiếm theo mã hoặc tên thiết bị"
            value={query.search}
            onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value }))}
          />
          <Select
            className="sm:w-56"
            value={query.status}
            onChange={(e) =>
              setQuery((q) => ({ ...q, status: e.target.value as DeviceQuery['status'] }))
            }
          >
            <option value="ALL">Trạng thái (Tất cả)</option>
            {DEVICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DEVICE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <DataTable
          columns={COLUMNS}
          rows={devices ?? []}
          rowKey={(d) => d.id}
          empty={loading ? 'Đang tải…' : 'Không tìm thấy thiết bị nào'}
        />
      </Card>
    </>
  );
}
