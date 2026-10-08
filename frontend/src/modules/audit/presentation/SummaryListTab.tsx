import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateAudit, canDeleteAudits } from '@/modules/auth/domain/session';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { formatDateTimeLocal, type AuditSummary } from '../domain/audit';
import { auditService } from '../infrastructure/container';
import { AuditEmptyState } from './AuditEmptyState';
import { CreateSummaryModal } from './CreateSummaryModal';

export function SummaryListTab() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [creating, setCreating] = useState(false);
  const canDelete = canDeleteAudits(session);
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsyncData(() => auditService.summaries(), [reloadKey]);
  const del = useAsyncAction(async (s: AuditSummary) => {
    if (!window.confirm(`Xoá bảng tổng hợp "${s.title}"? Không thể hoàn tác.`)) return;
    await auditService.removeSummary(s.id);
    setReloadKey((k) => k + 1);
  });

  const columns: Array<Column<AuditSummary>> = [
    { key: 'createdAt', header: 'Ngày lập', cell: (s) => formatDateTimeLocal(s.createdAt) },
    { key: 'title', header: 'Tiêu đề', cell: (s) => <span className="font-medium">{s.title}</span> },
    { key: 'purpose', header: 'Mục đích', cell: (s) => s.purpose ?? '—' },
    { key: 'count', header: 'Số đợt', align: 'right', cell: (s) => String(s.auditCount) },
    { key: 'createdBy', header: 'Người lập', cell: (s) => s.createdBy.fullName },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {canDelete && (
            <Button size="sm" variant="outline" disabled={del.pending} onClick={() => void del.run(s)}>
              Xoá
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/audit/summaries/${s.id}`)}>
            Xem
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {canCreateAudit(session) && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Lập bảng tổng hợp
          </Button>
        </div>
      )}
      {(del.error ?? error) && <p className="mb-3 text-sm text-status-dangerFg">{del.error ?? error}</p>}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(s) => String(s.id)}
        empty={loading ? 'Đang tải…' : <AuditEmptyState hint="Lập bảng tổng hợp từ các đợt kiểm kê đã duyệt" />}
      />
      <CreateSummaryModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(s) => navigate(`/audit/summaries/${s.id}`)}
      />
    </>
  );
}
