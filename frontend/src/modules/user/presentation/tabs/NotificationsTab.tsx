import { PrefToggle } from '../PrefToggle';
import type { TabProps } from './GeneralInfoTab';

/** ponytail: no Figma frame for this tab (Group 8 reuses the general-info mock) — field set is a
 *  reasonable default; refine when a real design lands. */
export function NotificationsTab({ draft, onChange }: TabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line p-6">
        <h3 className="text-base font-semibold text-ink">Kênh nhận thông báo</h3>
        <p className="mb-5 mt-1 text-sm text-ink-muted">Chọn nơi bạn muốn nhận nhắc việc.</p>
        <div className="space-y-4">
          <PrefToggle
            label="Gửi qua email"
            description={draft.email || 'Địa chỉ email trong tab Thông tin chung'}
            checked={draft.notifyEmail}
            onChange={(v) => onChange({ notifyEmail: v })}
          />
          <PrefToggle
            label="Hiển thị trong ứng dụng"
            checked={draft.notifyInApp}
            onChange={(v) => onChange({ notifyInApp: v })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line p-6">
        <h3 className="text-base font-semibold text-ink">Loại thông báo</h3>
        <p className="mb-5 mt-1 text-sm text-ink-muted">
          Áp dụng cho mọi thiết bị bạn đang phụ trách.
        </p>
        <div className="space-y-4">
          <PrefToggle
            label="Cấp phát và thu hồi thiết bị"
            checked={draft.notifyAllocation}
            onChange={(v) => onChange({ notifyAllocation: v })}
          />
          <PrefToggle
            label="Yêu cầu phê duyệt cần bạn xử lý"
            checked={draft.notifyApproval}
            onChange={(v) => onChange({ notifyApproval: v })}
          />
          <PrefToggle
            label="Điều chuyển thiết bị giữa các đơn vị"
            checked={draft.notifyTransfer}
            onChange={(v) => onChange({ notifyTransfer: v })}
          />
          <PrefToggle
            label="Nhắc lịch kiểm kê tài sản"
            checked={draft.notifyAudit}
            onChange={(v) => onChange({ notifyAudit: v })}
          />
        </div>
      </section>
    </div>
  );
}
