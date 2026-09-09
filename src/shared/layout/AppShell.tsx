import { Bell } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useSession } from '@/app/session/SessionContext';
import { Sidebar } from './Sidebar';

/** Authenticated chrome: sidebar + welcome bar. Pages render their own <PageHeader/> below. */
export function AppShell() {
  const { session } = useSession();
  const name = session?.displayName ?? 'bạn';

  return (
    <div className="flex min-h-screen bg-surface-app">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-8 pb-4 pt-6">
          <h1 className="font-display text-2xl font-bold text-ink">
            Chào mừng, <span className="text-brand">{name}!</span>
          </h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Thông báo"
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken"
            >
              <Bell className="h-5 w-5" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-sunken text-sm font-semibold text-ink-muted">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="flex-1 px-8 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
