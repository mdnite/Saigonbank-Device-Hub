import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { PRIMARY_NAV, SETTINGS_NAV, type NavItem } from './navItems';

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-surface-sunken text-ink'
            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
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
        {PRIMARY_NAV.map((item) => (
          <Item key={item.to} item={item} />
        ))}
      </nav>

      <div className="px-3 py-4">
        <Item item={SETTINGS_NAV} />
      </div>
    </aside>
  );
}
