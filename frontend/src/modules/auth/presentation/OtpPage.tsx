import { useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useCountdown } from '@/shared/lib/useCountdown';
import { authService } from '../infrastructure/container';

const LENGTH = 4;
// Khớp OTP_TTL_MS ở backend (src/shared/security/otp.ts) — hết giờ thì mã thật sự hết hạn.
const OTP_TTL_SECONDS = 5 * 60;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function OtpPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const { remaining, restart } = useCountdown(OTP_TTL_SECONDS);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputs.current[Math.min(pasted.length, LENGTH) - 1]?.focus();
  };

  const { run, pending, error } = useAsyncAction(async () => {
    const otp = digits.join('');
    await authService.verifyResetCode(email, otp);
    // State thay vì query: mã OTP không nằm trên URL / lịch sử trình duyệt.
    navigate('/reset-password', { state: { email, otp } });
  });

  const resend = useAsyncAction(async () => {
    await authService.requestPasswordReset(email);
    restart();
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
            onPaste={handlePaste}
            className="h-14 w-14 rounded-xl border border-line bg-white text-center text-xl font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        ))}
      </div>

      <div className="mt-3">
        {remaining > 0 ? (
          <p className="text-xs text-ink-muted">Mã hết hạn sau {formatMMSS(remaining)}</p>
        ) : (
          <button
            type="button"
            onClick={() => void resend.run()}
            disabled={resend.pending}
            className="text-xs font-semibold text-brand hover:underline disabled:opacity-60"
          >
            {resend.pending ? 'Đang gửi lại…' : 'Gửi lại mã'}
          </button>
        )}
        {resend.error && <p className="mt-1 text-xs text-status-dangerFg">{resend.error}</p>}
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
