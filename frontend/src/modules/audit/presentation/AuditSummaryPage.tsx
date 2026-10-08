import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/app/session/SessionContext';
import { canDeleteAudits } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { downloadCsv } from '@/shared/lib/downloadCsv';
import { formatDate, formatDateTimeLocal, matrixTotal, type AuditSummaryDetail, type MatrixRow } from '../domain/audit';
import { summaryCsv } from '../domain/auditCsv';
import { auditService } from '../infrastructure/container';

type Row = MatrixRow & { key: string };

export function AuditSummaryPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { session } = useSession();
  const { data: s, loading, error } = useAsyncData(() => auditService.summary(id), [id]);
  const pdf = useAsyncAction(async (summary: AuditSummaryDetail) => {
    const { downloadSummaryReport } = await import('./print/generateSummaryReport');
    downloadSummaryReport(summary);
  });

  const del = useAsyncAction(async (x: AuditSummaryDetail) => {
    if (!window.confirm(`Xoá bảng tổng hợp "${x.title}"? Không thể hoàn tác.`)) return;
    await auditService.removeSummary(x.id);
    navigate('/audit?tab=summary');
  });

  if (!s) return <p className="text-sm text-ink-muted">{loading ? 'Đang tải…' : error}</p>;

  const total = matrixTotal(s.matrix);
  const rows: Row[] = [
    ...s.matrix.map((r) => ({ ...r, key: `${r.unitName}|${r.deviceTypeName}` })),
    { key: 'total', unitName: 'Tổng cộng', deviceTypeName: '', ...total },
  ];
  const columns: Array<Column<Row>> = [
    { key: 'unit', header: 'Đơn vị', cell: (r) => <span className={r.key === 'total' ? 'font-semibold' : ''}>{r.unitName}</span> },
    { key: 'type', header: 'Loại thiết bị', cell: (r) => r.deviceTypeName },
    { key: 'total', header: 'Tổng', align: 'right', cell: (r) => String(r.total) },
    { key: 'ok', header: 'Đủ', align: 'right', cell: (r) => String(r.ok) },
    { key: 'missing', header: 'Thiếu', align: 'right', cell: (r) => String(r.missing) },
    { key: 'broken', header: 'Hỏng', align: 'right', cell: (r) => String(r.broken) },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Kiểm kê', to: '/audit?tab=summary' },
          { label: 'Bảng tổng hợp' },
        ]}
        title={s.title}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(`tong-hop-kiem-ke-${s.id}.csv`, summaryCsv(s))}>
              Xuất CSV
            </Button>
            <Button variant="outline" size="sm" disabled={pdf.pending} onClick={() => void pdf.run(s)}>
              Xuất PDF
            </Button>
            {canDeleteAudits(session) && (
              <Button variant="outline" size="sm" disabled={del.pending} onClick={() => void del.run(s)}>
                Xoá
              </Button>
            )}
          </>
        }
      />
      <Card className="mb-5 p-5">
        <p className="mb-3 text-sm text-ink-muted">
          {s.purpose && `Mục đích: ${s.purpose} · `}Người lập: {s.createdBy.fullName} · Ngày lập: {formatDateTimeLocal(s.createdAt)}
        </p>
        <ul className="space-y-1 text-sm">
          {s.audits.map((a) => (
            <li key={a.id}>
              <Link className="text-brand hover:underline" to={`/audit/${a.id}`}>
                Đợt #{a.id}
              </Link>{' '}
              · {a.unitName} · {a.purpose} · đến {formatDate(a.dueDate)} · {a.deviceCount} thiết bị
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        {(pdf.error ?? del.error) && <p className="mb-3 text-sm text-status-dangerFg">{pdf.error ?? del.error}</p>}
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} />
      </Card>
    </>
  );
}
