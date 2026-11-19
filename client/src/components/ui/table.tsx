import { useMemo, useState, type ReactNode } from 'react';
import clsx from '@/lib/cn';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  /** hidden below md breakpoint */
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows, columns, onRowClick, empty, initialSort, footer, rowClassName, dense, pageSize = 100,
}: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (r: T) => void; empty?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' }; footer?: ReactNode; rowClassName?: (r: T) => string | undefined;
  dense?: boolean; pageSize?: number;
}) {
  const [sort, setSort] = useState(initialSort);
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    const out = [...rows].sort((a, b) => {
      const x = f(a), y = f(b);
      return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true });
    });
    return sort!.dir === 'desc' ? out.reverse() : out;
  }, [rows, columns, sort]);

  if (!rows.length && empty) return <>{empty}</>;
  const visible = sorted.slice(0, limit);

  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} style={{ width: c.width }} scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={clsx('h-9 px-3 text-[12.5px] font-medium whitespace-nowrap text-ink-3 first:pl-4 last:pr-4',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideOnMobile && 'max-md:hidden')}>
                  {c.sort ? (
                    <button className={clsx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}
                      onClick={() => setSort({ key: c.key, dir: active && sort!.dir === 'asc' ? 'desc' : 'asc' })}>
                      {c.header}
                      {active && (sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={clsx('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2', rowClassName?.(r))}>
              {columns.map((c) => (
                <td key={c.key}
                  className={clsx(dense ? 'h-10' : 'h-11', 'px-3 align-middle first:pl-4 last:pr-4',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideOnMobile && 'max-md:hidden', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="border-t border-line-strong bg-surface-2/60 font-medium">{footer}</tfoot>}
      </table>
      {sorted.length > limit && (
        <div className="border-t border-line p-2 text-center">
          <button className="rounded-md px-3 py-1.5 text-[13px] font-medium text-copper-strong hover:bg-copper-soft" onClick={() => setLimit((l) => l + pageSize)}>
            Afficher {Math.min(pageSize, sorted.length - limit)} de plus ({sorted.length - limit} restants)
          </button>
        </div>
      )}
    </div>
  );
}

/** Stops row click when pressing a button inside a row. */
export const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
