import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/inputs';
import { Checkbox } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { authService } from '../infrastructure/container';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const { run, pending, error } = useAsyncAction(async () => {
    await authService.resetPassword(email, password, confirm);
    navigate('/login', { replace: true });
  });

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
        <Checkbox
          id="show-pw"
          label="Hiện mật khẩu"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-status-dangerFg">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </div>
    </form>
  );
}
