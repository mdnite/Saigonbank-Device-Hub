import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { PrefToggle } from '../PrefToggle';
import type { TabProps } from './GeneralInfoTab';

/** ponytail: no Figma frame for this tab (Group 9 reuses the general-info mock). Password change
 *  reuses the forgot-password → OTP → reset flow (reset needs an OTP) until a change-password API exists. */
export function SecurityTab({ draft, onChange }: TabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line p-6">
        <h3 className="mb-5 text-base font-semibold text-ink">Đăng nhập</h3>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Mật khẩu</p>
              <p className="text-xs text-ink-muted">Đổi lần cuối hơn 90 ngày trước.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/forgot-password')}>
              Đổi mật khẩu
            </Button>
          </div>
          <PrefToggle
            label="Bật xác thực hai lớp"
            description="Yêu cầu mã OTP mỗi khi đăng nhập trên thiết bị mới."
            checked={draft.twoFactorEnabled}
            onChange={(v) => onChange({ twoFactorEnabled: v })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line p-6">
        <h3 className="mb-5 text-base font-semibold text-ink">Quyền riêng tư</h3>
        <PrefToggle
          label="Cho đồng nghiệp thấy trạng thái hoạt động của tôi"
          description="Khi tắt, người khác không thấy bạn đang online trong ứng dụng."
          checked={draft.showActivityStatus}
          onChange={(v) => onChange({ showActivityStatus: v })}
        />
      </section>
    </div>
  );
}
