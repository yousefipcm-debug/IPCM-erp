import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from '@/lib/cn';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { computeAlerts, useFinance } from '@/lib/finance';
import { PageHeader, Segmented, EmptyState } from '@/components/ui/ui';

export function AlertsPage() {
  const f = useFinance();
  const nav = useNavigate();
  const all = useMemo(() => computeAlerts(f), [f]);
  const [filter, setFilter] = useState<'all' | 'danger' | 'warn'>('all');
  const list = filter === 'all' ? all : all.filter((a) => a.level === filter);
  const nDanger = all.filter((a) => a.level === 'danger').length;

  return (
    <>
      <PageHeader title="Alertes" description="Calculées en continu à partir des journaux, situations et dettes."
        actions={<Segmented size="sm" value={filter} onChange={setFilter} options={[
          { value: 'all', label: `Toutes (${all.length})` }, { value: 'danger', label: `Prioritaires (${nDanger})` }, { value: 'warn', label: `À surveiller (${all.length - nDanger})` },
        ]} />} />
      <div className="panel">
        {list.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5 text-pos" />} title="Aucune alerte">La trésorerie, les créances et les dettes sont dans les limites.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a, i) => (
              <li key={i}>
                <button onClick={() => a.to && nav(a.to)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-surface-2/70">
                  <span className={clsx('h-9 w-1 shrink-0 rounded-full', a.level === 'danger' ? 'bg-neg' : 'bg-warn')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{a.title}</span>
                    <span className="block text-[13px] text-ink-3">{a.detail}</span>
                  </span>
                  {a.to && <ChevronRight className="size-4 shrink-0 text-ink-3" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
