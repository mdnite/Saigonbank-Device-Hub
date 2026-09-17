import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Send } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/inputs';
import { Field } from '@/shared/ui/Field';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { authService } from '../infrastructure/container';
import { AuthHeading } from './AuthHeading';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const { run, pending, error } = useAsyncAction(async () => {
    await authService.requestPasswordReset(email);
    navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <AuthHeading icon={<KeyRound className="h-5 w-5" />}>Khôi phục mật khẩu</AuthHeading>

      <Field label="Email" htmlFor="email" error={error}>
        <Input
          id="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button type="submit" disabled={pending} leadingIcon={<Send className="h-4 w-4" />}>
          {pending ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </Button>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Đăng nhập
        </Link>
      </div>
    </form>
  );
}
