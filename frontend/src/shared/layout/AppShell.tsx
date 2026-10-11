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
        <header className="px-8 pb-4 pt-6">
          <h1 className="font-display text-2xl font-bold text-ink">
            Chào mừng, <span className="text-brand">{name}!</span>
          </h1>
        </header>

        <main className="flex-1 px-8 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
