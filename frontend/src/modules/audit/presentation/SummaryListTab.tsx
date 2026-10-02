import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateAudit } from '@/modules/auth/domain/session';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { formatDate, type AuditSummary } from '../domain/audit';
import { auditService } from '../infrastructure/container';
import { AuditEmptyState } from './AuditEmptyState';
import { CreateSummaryModal } from './CreateSummaryModal';

export function SummaryListTab() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [creating, setCreating] = useState(false);
  const { data, loading, error } = useAsyncData(() => auditService.summaries(), []);

  const columns: Array<Column<AuditSummary>> = [
    { key: 'createdAt', header: 'Ngày lập', cell: (s) => formatDate(s.createdAt) },
    { key: 'title', header: 'Tiêu đề', cell: (s) => <span className="font-medium">{s.title}</span> },
    { key: 'purpose', header: 'Mục đích', cell: (s) => s.purpose ?? '—' },
    { key: 'count', header: 'Số đợt', align: 'right', cell: (s) => String(s.auditCount) },
    { key: 'createdBy', header: 'Người lập', cell: (s) => s.createdBy.fullName },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/audit/summaries/${s.id}`)}>
          Xem
        </Button>
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
      {error && <p className="mb-3 text-sm text-status-dangerFg">{error}</p>}
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
