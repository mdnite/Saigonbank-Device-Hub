import { forwardRef, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useSession } from '@/app/session/SessionContext';
import { authService } from '../infrastructure/container';

/** Underline-style field, specific to the login screen. */
const LineField = forwardRef<
  HTMLInputElement,
  {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    trailing?: ReactNode;
  }
>(function LineField({ label, type = 'text', value, onChange, onKeyDown, trailing }, ref) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="mt-2 flex items-center border-b border-ink/30 focus-within:border-brand">
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border-0 bg-transparent pb-1.5 text-sm outline-none"
        />
        {trailing}
      </span>
    </label>
  );
});

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { signIn, notice } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const { run, pending, error } = useAsyncAction(async () => {
    const session = await authService.login({ username, password });
    signIn(session);
    navigate(redirectTo, { replace: true });
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#4E8C86] text-white">
        <User className="h-7 w-7" />
      </div>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-wide text-brand-heading">
        WELCOME
      </h1>

      <div className="space-y-6">
        <LineField
          label="Username"
          value={username}
          onChange={setUsername}
          onKeyDown={(e) => {
            // Enter ở ô Username: sang ô Password thay vì gửi form ngay.
            if (e.key === 'Enter') {
              e.preventDefault();
              passwordRef.current?.focus();
            }
          }}
        />
        <LineField
          ref={passwordRef}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          trailing={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((v) => !v)}
              className="pb-1.5 pl-2 text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
      </div>

      {notice && !error && <p className="mt-3 text-sm text-status-warnFg">{notice}</p>}
      {error && <p className="mt-3 text-sm text-status-dangerFg">{error}</p>}

      <div className="mt-2 flex justify-end">
        <Link to="/forgot-password" className="text-sm font-semibold text-ink hover:text-brand">
          Forgot Password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="soft"
        disabled={pending}
        className="mt-3 w-full tracking-widest"
      >
        {pending ? 'ĐANG XỬ LÝ…' : 'LOGIN'}
      </Button>
    </form>
  );
}
