/** Khối Người tạo / Người duyệt / Lý do từ chối — dùng chung cho chi tiết đơn và lệnh. */
export function DecisionInfo({
  createdBy,
  createdAt,
  decidedBy,
  decidedAt,
  rejectReason,
}: {
  createdBy: { fullName: string };
  createdAt: string;
  decidedBy: { fullName: string } | null;
  decidedAt: string | null;
  rejectReason: string | null;
}) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Người tạo</dt>
          <dd className="font-medium text-ink">{createdBy.fullName}</dd>
          <dd className="text-ink-muted">{createdAt.slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Người duyệt</dt>
          {decidedBy ? (
            <>
              <dd className="font-medium text-ink">{decidedBy.fullName}</dd>
              <dd className="text-ink-muted">{decidedAt?.slice(0, 10)}</dd>
            </>
          ) : (
            <dd className="text-ink-muted">Chưa duyệt</dd>
          )}
        </div>
      </dl>
      {rejectReason && (
        <div className="rounded-lg bg-status-dangerBg p-3 text-sm">
          <p className="font-semibold text-status-dangerFg">Lý do từ chối</p>
          <p className="mt-1 text-ink">{rejectReason}</p>
        </div>
      )}
    </div>
  );
}
