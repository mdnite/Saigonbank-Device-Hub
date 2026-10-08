import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session/SessionContext';
import { canDeleteAudits } from '@/modules/auth/domain/session';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import {
  AUDIT_STATUS,
  DELETABLE_AUDIT_STATUSES,
  formatDate,
  formatDateTimeLocal,
  isOverdue,
  todayIso,
  type Audit,
  type AuditStatus,
  type PurgeResult,
} from '../domain/audit';
import { auditService } from '../infrastructure/container';
import { AUDIT_STATUS_TONE } from './auditStatusTone';
import { AuditEmptyState } from './AuditEmptyState';

export function AuditListTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AuditStatus | ''>('');
  const { session } = useSession();
  const canDelete = canDeleteAudits(session);
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsyncData(
    () => auditService.list({ q: q || undefined, status: status || undefined }),
    [q, status, reloadKey],
  );
  const [skipped, setSkipped] = useState<PurgeResult['skipped']>([]);

  const del = useAsyncAction(async (a: Audit) => {
    if (!window.confirm(`Xoá đợt kiểm kê #${a.id} (${a.unitName})? Đợt sẽ vào thùng rác.`)) return;
    await auditService.remove(a.id);
    setReloadKey((k) => k + 1);
  });
  const purge = useAsyncAction(async () => {
    const ids = (data ?? []).map((a) => a.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Xoá vĩnh viễn ${ids.length} đợt kiểm kê? Không thể khôi phục.`)) return;
    const res = await auditService.purge(ids);
    setSkipped(res.skipped);
    setReloadKey((k) => k + 1);
  });
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
        <div className="flex justify-end gap-2">
          {canDelete && DELETABLE_AUDIT_STATUSES.includes(a.status) && (
            <Button size="sm" variant="outline" disabled={del.pending} onClick={() => void del.run(a)}>
              Xoá
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/audit/${a.id}`)}>
            Xem
          </Button>
        </div>
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
        <Select className="sm:w-56" value={status} onChange={(e) => {
            setStatus(e.target.value as AuditStatus | '');
            setSkipped([]);
          }}
        >
          <option value="">Trạng thái (Tất cả)</option>
          {Object.values(AUDIT_STATUS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {canDelete && status === AUDIT_STATUS.DELETED && (data?.length ?? 0) > 0 && (
          <Button variant="outline" size="sm" disabled={purge.pending} onClick={() => void purge.run()}>
            Dọn thùng rác
          </Button>
        )}
      </div>
      {(del.error ?? purge.error ?? error) && (
        <p className="mb-3 text-sm text-status-dangerFg">{del.error ?? purge.error ?? error}</p>
      )}
      {skipped.length > 0 && (
        <div role="status" className="mb-3 rounded-lg bg-status-warnBg px-4 py-3 text-sm text-status-warnFg">
          Không xoá được {skipped.length} đợt:
          <ul className="mt-1 list-disc pl-5">
            {skipped.map((s) => (
              <li key={s.id}>
                Đợt #{s.id} ({s.unitName}): {s.reasons.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(a) => String(a.id)}
        empty={loading ? 'Đang tải…' : <AuditEmptyState />}
      />
    </>
  );
}
