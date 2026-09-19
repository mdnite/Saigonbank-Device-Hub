import { LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '@/app/session/SessionContext';
import { isAdmin } from '@/modules/auth/domain/session';
import { cn } from '@/shared/lib/cn';
import { PRIMARY_NAV, SETTINGS_NAV, type NavItem } from './navItems';

const ITEM_BASE = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition';
const ITEM_IDLE = 'text-ink-muted hover:bg-surface-sunken hover:text-ink';

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(ITEM_BASE, isActive ? 'bg-surface-sunken text-ink' : ITEM_IDLE)
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();

  // JWT stateless: đăng xuất = xoá session (có token) khỏi state + localStorage, không gọi BE.
  const logout = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
          ID
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-ink">IDSM</span>
      </div>
      <div className="mx-5 border-b border-line" />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {PRIMARY_NAV.filter((item) => !item.adminOnly || isAdmin(session)).map((item) => (
          <Item key={item.to} item={item} />
        ))}
      </nav>

      <div className="space-y-1 px-3 py-4">
        <Item item={SETTINGS_NAV} />
        <button type="button" onClick={logout} className={cn(ITEM_BASE, ITEM_IDLE, 'w-full')}>
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
