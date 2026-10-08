import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '@/app/session/SessionContext';
import { canCreateAudit, canDecideAudit } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Tabs } from '@/shared/ui/Tabs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { downloadCsv } from '@/shared/lib/downloadCsv';
import { AUDIT_STATUS, formatDate, isOverdue, todayIso, type AuditDetail } from '../domain/audit';
import { auditCsv } from '../domain/auditCsv';
import { auditService } from '../infrastructure/container';
import { AUDIT_STATUS_TONE } from './auditStatusTone';
import { AuditItemsTable } from './AuditItemsTable';
import { AuditMembersTab } from './AuditMembersTab';

export function AuditDetailPage() {
  const auditId = Number(useParams().id);
  const { session } = useSession();
  const isSpecialist = canCreateAudit(session);
  const isHead = canDecideAudit(session);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState('items');

  useEffect(() => {
    auditService
      .get(auditId)
      .then(setDetail)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Không tải được dữ liệu'));
  }, [auditId]);

  // Mọi thao tác đều trả lại chi tiết mới nhất từ backend — thay thẳng state, không tự vá cục bộ.
  // Nhiều lần lưu có thể chạy chồng nhau: chỉ phản hồi của lần gọi mới nhất được áp dụng, tránh ảnh chụp cũ ghi đè.
  const seq = useRef(0);
  const act = useAsyncAction(async (fn: () => Promise<AuditDetail>) => {
    const mine = ++seq.current;
    const next = await fn();
    if (mine === seq.current) setDetail(next);
  });

  // PDF chỉ đọc dữ liệu hiện có — tách khỏi `act` để không ghi đè trang bằng ảnh chụp cũ.
  const pdf = useAsyncAction(async (d: AuditDetail) => {
    // Font DejaVu ~1MB: dynamic import để tách khỏi bundle chính, chỉ tải khi bấm.
    const { downloadAuditReport } = await import('./print/generateAuditReport');
    downloadAuditReport(d);
  });

  if (!detail) {
    return <p className="text-sm text-ink-muted">{loadError ?? 'Đang tải…'}</p>;
  }

  const { status } = detail;
  const editable = isSpecialist && status === AUDIT_STATUS.IN_PROGRESS;
  const membersEditable =
    isSpecialist && (status === AUDIT_STATUS.NOT_STARTED || status === AUDIT_STATUS.IN_PROGRESS);
  const allCounted = detail.countedLines === detail.totalLines;

  const cancel = () => {
    if (window.confirm('Huỷ đợt kiểm kê này? Thiết bị sẽ được nhả cho đợt khác.')) {
      void act.run(() => auditService.cancel(auditId));
    }
  };
  const approve = () => {
    if (
      window.confirm(
        'Duyệt kết quả kiểm kê? Thiết bị "Thiếu" sẽ chuyển Thất lạc, "Hỏng" sẽ chuyển Chờ thanh lý.',
      )
    ) {
      void act.run(() => auditService.approve(auditId));
    }
  };
  const reject = () => {
    const reason = window.prompt('Lý do từ chối');
    if (reason && reason.trim()) void act.run(() => auditService.reject(auditId, reason.trim()));
  };

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Kiểm kê', to: '/audit' },
          { label: `Đợt #${detail.id}` },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Kiểm kê thiết bị tại {detail.unitName} đến ngày {formatDate(detail.dueDate)}
            <Badge tone={AUDIT_STATUS_TONE[status]}>{status}</Badge>
            {isOverdue(detail, todayIso()) && <Badge tone="danger">Quá hạn</Badge>}
          </span>
        }
      />

      <Card className="p-5">
        <p className="mb-4 text-sm text-ink-muted">
          Mục đích: {detail.purpose}
          {detail.deviceTypeName && ` · Loại thiết bị: ${detail.deviceTypeName}`}
          {detail.location && ` · Vị trí: ${detail.location}`}
          {` · Người lập: ${detail.createdBy.fullName}`}
          {detail.decidedBy && status === AUDIT_STATUS.APPROVED && ` · Người duyệt: ${detail.decidedBy.fullName}`}
        </p>

        {detail.rejectReason && status === AUDIT_STATUS.IN_PROGRESS && (
          <div role="alert" className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-dangerFg">
            Bị từ chối: {detail.rejectReason}
          </div>
        )}

        <Tabs
          items={[
            { id: 'items', label: 'Thiết bị kiểm kê' },
            { id: 'members', label: 'Thành viên tham gia', badge: detail.members.length || undefined },
          ]}
          active={tab}
          onChange={setTab}
          className="mb-5"
        />

        {tab === 'items' ? (
          <AuditItemsTable
            detail={detail}
            editable={editable}
            onUpdateItem={(itemId, patch) => void act.run(() => auditService.updateItem(auditId, itemId, patch))}
            onUpdateAccessory={(accId, patch) =>
              void act.run(() => auditService.updateAccessory(auditId, accId, patch))
            }
          />
        ) : (
          <AuditMembersTab
            members={detail.members}
            editable={membersEditable}
            onSave={(userIds) => act.run(() => auditService.setMembers(auditId, userIds))}
          />
        )}

        {(act.error || pdf.error) && (
          <p className="mt-4 text-right text-sm text-status-dangerFg">{act.error ?? pdf.error}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => downloadCsv(`kiem-ke-${detail.id}.csv`, auditCsv(detail))}>
            Xuất CSV
          </Button>
          <Button
            variant="outline"
            disabled={pdf.pending}
            onClick={() => void pdf.run(detail)}
          >
            Xuất PDF
          </Button>
          {isSpecialist && status === AUDIT_STATUS.NOT_STARTED && (
            <>
              <Button variant="outline" disabled={act.pending} onClick={cancel}>
                Huỷ đợt
              </Button>
              <Button variant="dark" disabled={act.pending} onClick={() => void act.run(() => auditService.start(auditId))}>
                Bắt đầu kiểm kê
              </Button>
            </>
          )}
          {editable && (
            <>
              <Button
                variant="outline"
                disabled={act.pending || allCounted}
                onClick={() => void act.run(() => auditService.markUncountedOk(auditId))}
              >
                Ghi Đủ cho dòng chưa đếm
              </Button>
              <Button
                variant="dark"
                disabled={act.pending || !allCounted}
                title={allCounted ? undefined : 'Còn dòng chưa có kết quả'}
                onClick={() => void act.run(() => auditService.submit(auditId))}
              >
                Gửi duyệt
              </Button>
            </>
          )}
          {isHead && status === AUDIT_STATUS.PENDING && (
            <>
              <Button variant="outline" disabled={act.pending} onClick={reject}>
                Từ chối
              </Button>
              <Button variant="dark" disabled={act.pending} onClick={approve}>
                Duyệt
              </Button>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
