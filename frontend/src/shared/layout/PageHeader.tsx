import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

/** Breadcrumb + page title + optional right-aligned actions. Sits directly under the AppShell welcome bar. */
export function PageHeader({
  breadcrumb,
  title,
  actions,
}: {
  breadcrumb?: Crumb[];
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 text-sm text-ink-muted">
          {breadcrumb.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="mx-1.5 text-ink-faint">/</span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="text-brand">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
