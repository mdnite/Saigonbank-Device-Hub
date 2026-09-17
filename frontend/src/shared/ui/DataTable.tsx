import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<Row> {
  columns: Array<Column<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
  className?: string;
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty = 'Không có dữ liệu',
  className,
}: DataTableProps<Row>) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-line', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn('px-4 py-3 font-semibold', alignClass[c.align ?? 'left'])}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-ink-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line hover:bg-surface-app/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3 text-ink', alignClass[c.align ?? 'left'])}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
