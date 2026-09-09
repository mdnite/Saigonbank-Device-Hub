import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { authService } from '../infrastructure/container';

const LENGTH = 4;

export function OtpPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const { run, pending, error } = useAsyncAction(async () => {
    await authService.verifyResetCode(email, digits.join(''));
    navigate(`/reset-password?email=${encodeURIComponent(email)}`);
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <h1 className="font-display text-2xl font-semibold text-ink">Nhập mã gồm 4 chữ số</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Để tiếp tục, hãy hoàn tất xác minh email nhằm xác nhận tài khoản này thuộc về bạn
        {email ? ` (${email})` : ''}.
      </p>

      <div className="mt-6 flex gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) inputs.current[i - 1]?.focus();
            }}
            className="h-14 w-14 rounded-xl border border-line bg-white text-center text-xl font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-status-dangerFg">{error}</p>}

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button
          type="submit"
          disabled={pending || digits.some((d) => !d)}
          leadingIcon={<Send className="h-4 w-4" />}
        >
          {pending ? 'Đang kiểm tra…' : 'Gửi yêu cầu'}
        </Button>
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </Link>
      </div>
    </form>
  );
}
