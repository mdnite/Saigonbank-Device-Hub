import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useSession } from '@/app/session/SessionContext';
import { authService } from '../infrastructure/container';

/** Underline-style field, specific to the login screen. */
function LineField({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border-0 border-b border-ink/30 bg-transparent pb-1.5 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        <LineField label="Username" value={username} onChange={setUsername} />
        <LineField label="Password" type="password" value={password} onChange={setPassword} />
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
