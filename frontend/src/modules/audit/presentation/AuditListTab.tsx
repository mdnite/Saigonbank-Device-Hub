import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { AUDIT_STATUS, formatDate, formatDateTimeLocal, isOverdue, todayIso, type Audit, type AuditStatus } from '../domain/audit';
import { auditService } from '../infrastructure/container';
import { AUDIT_STATUS_TONE } from './auditStatusTone';
import { AuditEmptyState } from './AuditEmptyState';

export function AuditListTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AuditStatus | ''>('');
  const { data, loading, error } = useAsyncData(
    () => auditService.list({ q: q || undefined, status: status || undefined }),
    [q, status],
  );
  const today = todayIso();

  const columns: Array<Column<Audit>> = [
    { key: 'createdAt', header: 'Ngày tạo lịch', cell: (a) => formatDateTimeLocal(a.createdAt) },
    { key: 'unit', header: 'Đơn vị kiểm kê', cell: (a) => a.unitName },
    { key: 'purpose', header: 'Mục đích', cell: (a) => a.purpose },
    { key: 'dueDate', header: 'Đến ngày', cell: (a) => formatDate(a.dueDate) },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={AUDIT_STATUS_TONE[a.status]}>{a.status}</Badge>
          {isOverdue(a, today) && <Badge tone="danger">Quá hạn</Badge>}
        </div>
      ),
    },
    { key: 'progress', header: 'Tiến độ', align: 'right', cell: (a) => `${a.countedLines}/${a.totalLines}` },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (a) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/audit/${a.id}`)}>
          Xem
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          placeholder="Tìm theo đơn vị hoặc mục đích"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select className="sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as AuditStatus | '')}>
          <option value="">Trạng thái (Tất cả)</option>
          {Object.values(AUDIT_STATUS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="mb-3 text-sm text-status-dangerFg">{error}</p>}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(a) => String(a.id)}
        empty={loading ? 'Đang tải…' : <AuditEmptyState />}
      />
    </>
  );
}
