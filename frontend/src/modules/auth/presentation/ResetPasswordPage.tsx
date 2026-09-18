import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/inputs';
import { Checkbox } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { validatePasswordReset } from '../domain/credentials';
import { authService } from '../infrastructure/container';

export function ResetPasswordPage() {
  // OtpPage chuyển sang bằng router state; mất khi F5 hoặc vào thẳng URL.
  const reset = useLocation().state as { email: string; otp: string } | null;
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const liveErrors = confirm.length > 0 ? validatePasswordReset(password, confirm) : [];
  const canSubmit = password.length > 0 && confirm.length > 0 && liveErrors.length === 0;

  const { run, pending, error } = useAsyncAction(async () => {
    if (!reset) return;
    await authService.resetPassword(reset.email, reset.otp, password, confirm);
    navigate('/login', { replace: true });
  });

  if (!reset) {
    return (
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold text-ink">Đổi mật khẩu</h1>
        <p className="text-sm text-ink-muted">
          Phiên đặt lại mật khẩu đã hết, vui lòng yêu cầu mã mới.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Quên mật khẩu
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <h1 className="mb-8 font-display text-2xl font-semibold text-ink">Đổi mật khẩu</h1>

      <div className="space-y-4">
        <Input
          type={show ? 'text' : 'password'}
          placeholder="Tạo mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type={show ? 'text' : 'password'}
          placeholder="Xác nhận"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {liveErrors[0] && <p className="text-xs text-status-dangerFg">{liveErrors[0]}</p>}
        <Checkbox
          id="show-pw"
          label="Hiện mật khẩu"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-status-dangerFg">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </div>
    </form>
  );
}
