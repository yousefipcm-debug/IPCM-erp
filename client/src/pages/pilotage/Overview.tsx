import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import clsx from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { useFinance, computeAlerts, runwayLabel, signed } from '@/lib/finance';
import { MONTHS_SHORT, money, moneyShort, dateShort, capitalize } from '@/lib/format';
import { Amount, Badge, Button, Panel, ProgressBar } from '@/components/ui/ui';
import { TransactionDialog } from '@/components/finance/TransactionDialog';
import { navFor } from '@/nav';

export function OverviewPage() {
  const { user } = useAuth();
  if (user!.role !== 'admin' && user!.role !== 'finance') return <RoleHome />;
  return <FinanceOverview />;
}

function FinanceOverview() {
  const f = useFinance();
  const nav = useNavigate();
  const alerts = useMemo(() => computeAlerts(f), [f]);
  const [tx, setTx] = useState<null | 'caisse' | 'banque'>(null);

  // Last 6 months: entries, exits and month-end treasury
  const chart = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: capitalize(MONTHS_SHORT[d.getMonth()]), in: 0, out: 0, balance: 0 };
    });
    const idx = new Map(months.map((m, i) => [m.key, i]));
    let before = 0;
    for (const t of f.transactions) {
      const k = (t.date || '').slice(0, 7);
      const i = idx.get(k);
      if (i === undefined) { if (k < months[0].key) before += signed(t); continue; }
      if (t.type === 'in') months[i].in += t.amount; else months[i].out += t.amount;
    }
    let run = before;
    for (const m of months) { run += m.in - m.out; m.balance = run; }
    return months;
  }, [f.transactions]);

  const recent = useMemo(() => [...f.transactions].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b._updatedAt || '').localeCompare(a._updatedAt || '')).slice(0, 7), [f.transactions]);
  const agingTotal = Object.values(f.aging).reduce((s, v) => s + v, 0);
  const dangerCount = alerts.filter((a) => a.level === 'danger').length;
  const runwayTone = !Number.isFinite(f.runwayMonths) ? undefined : f.runwayMonths < 4 ? 'neg' : f.runwayMonths < 7 ? 'warn' : 'pos';

  return (
    <div className="space-y-5">
      {/* Treasury */}
      <section className="panel overflow-hidden">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col justify-center p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-ink-2">Trésorerie disponible</p>
              <div className="flex gap-2">
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setTx('caisse')}>Caisse</Button>
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setTx('banque')}>Banque</Button>
              </div>
            </div>
            <p className={clsx('num mt-2 text-[40px] leading-none font-semibold tracking-[-0.025em] sm:text-[52px]', f.balance.treasury < 0 && 'text-neg')}>
              {money(f.balance.treasury, { unit: false })}<span className="ml-2 text-[0.42em] font-medium text-ink-3">DA</span>
            </p>
            {(() => {
              const pos = Math.max(0, f.balance.banque) + Math.max(0, f.balance.caisse);
              const pb = pos > 0 ? (Math.max(0, f.balance.banque) / pos) * 100 : 50;
              return (
                <div className="anim-beam mt-5 flex h-[4px] w-full gap-[3px]" title="Répartition banque / caisse">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${pb}%` }} />
                  <div className="h-full flex-1 rounded-full bg-copper" />
                </div>
              );
            })()}
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
              <Link to="/dfc/journaux?j=banque" className="inline-flex items-center gap-1.5 hover:underline"><span className="size-2 rounded-full bg-teal" /><span className="text-ink-3">Banque </span><Amount value={f.balance.banque} className="font-medium" /></Link>
              <Link to="/dfc/journaux?j=caisse" className="inline-flex items-center gap-1.5 hover:underline"><span className="size-2 rounded-full bg-copper" /><span className="text-ink-3">Caisse </span><Amount value={f.balance.caisse} className="font-medium" /></Link>
              <Link to="/dfc/caisse-terkmane" className="hover:underline"><span className="text-ink-3">Caisse Mme Terkmane </span><Amount value={f.balance.pettyCash} className="font-medium" /></Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 border-t border-line lg:grid-cols-1 lg:border-t-0 lg:border-l">
            {[
              { label: 'Créances clients', value: money(f.receivables), to: '/dfc/situations', sub: `${f.situations.filter((s) => !s.isPaid).length} situation(s) impayée(s)` },
              { label: 'Dettes fournisseurs', value: money(f.payables), to: '/dfc/fournisseurs', sub: `${f.supplierInvoices.filter((s) => !s.isPaid).length} facture(s) à régler` },
              { label: 'Charges fixes par mois', value: money(f.monthlyCharges), to: '/dfc/charges', sub: `${f.charges.length} ligne(s)` },
              { label: 'Autonomie de trésorerie', value: runwayLabel(f.runwayMonths), to: '/dfc/previsionnel', sub: 'Trésorerie ÷ charges mensuelles', tone: runwayTone },
            ].map((k, i) => (
              <Link key={k.label} to={k.to} className={clsx('group flex flex-col justify-center px-5 py-3.5 hover:bg-surface-2/70', i % 2 === 1 && 'max-lg:border-l', i > 1 && 'max-lg:border-t', i > 0 && 'lg:border-t', 'border-line')}>
                <dt className="flex items-center justify-between text-[13px] text-ink-3">{k.label}<ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></dt>
                <dd className={clsx('num text-[17px] font-semibold tracking-tight', k.tone === 'neg' && 'text-neg', k.tone === 'warn' && 'text-warn', k.tone === 'pos' && 'text-pos')}>{k.value}</dd>
                <dd className="text-xs text-ink-3">{k.sub}</dd>
              </Link>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Flux des 6 derniers mois" description="Entrées et sorties des journaux, solde en fin de mois" bodyClassName="px-2 pt-4 pb-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={62} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickFormatter={(v) => moneyShort(v).replace(' DA', '')} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip />} />
                <Bar dataKey="in" name="Entrées" fill="var(--teal)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="out" name="Sorties" fill="var(--line-strong)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line dataKey="balance" name="Solde" stroke="var(--copper)" strokeWidth={2.25} dot={{ r: 3, fill: 'var(--copper)' }} type="linear" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 px-3 pb-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal" />Entrées</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-line-strong" />Sorties</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-copper" />Solde</span>
          </div>
        </Panel>

        <Panel title="À traiter" actions={<Link to="/alertes" className="text-[13px] font-medium text-copper-strong hover:underline">Toutes les alertes ({alerts.length})</Link>} bodyClassName="p-0">
          {alerts.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13.5px] text-ink-3">Rien d’urgent. Les alertes apparaîtront ici.</p>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.slice(0, 5).map((a, i) => (
                <li key={i}>
                  <button onClick={() => a.to && nav(a.to)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/70">
                    <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', a.level === 'danger' ? 'bg-neg' : 'bg-warn')} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium">{a.title}</span>
                      <span className="block text-[12.5px] text-ink-3">{a.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dangerCount > 0 && <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-neg"><AlertTriangle className="size-3.5" />{dangerCount} alerte(s) prioritaire(s)</p>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Derniers mouvements" actions={<Link to="/dfc/journaux" className="text-[13px] font-medium text-copper-strong hover:underline">Ouvrir les journaux</Link>} bodyClassName="p-0">
          {recent.length === 0 ? <p className="px-4 py-10 text-center text-[13.5px] text-ink-3">Aucun mouvement enregistré.</p> : (
            <ul className="divide-y divide-line">
              {recent.map((t) => {
                const party = t.type === 'in' ? f.clientById.get(t.clientId || '')?.name : f.supplierById.get(t.supplierId || '')?.name;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-[74px] shrink-0 text-xs text-ink-3 num">{dateShort(t.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{t.description || `${t.type === 'in' ? 'Encaissement' : 'Paiement'}${party ? ` ${party}` : ''}`}</span>
                      <span className="block truncate text-xs text-ink-3">{t.journal === 'banque' ? 'Banque' : 'Caisse'}{party && t.description ? `, ${party}` : ''}</span>
                    </span>
                    <Amount value={t.amount} signedDisplay={t.type} className="text-[13.5px] font-medium" />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Ancienneté des créances" actions={<Link to="/dfc/balance-agee" className="text-[13px] font-medium text-copper-strong hover:underline">Détail</Link>}>
          {agingTotal <= 0 ? <p className="py-6 text-center text-[13.5px] text-ink-3">Aucune créance en cours.</p> : (
            <div className="space-y-3">
              {(['0-30', '31-60', '61-90', '90+'] as const).map((b) => (
                <div key={b}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="text-ink-2">{b === '90+' ? 'Plus de 90 jours' : `${b.replace('-', ' à ')} jours`}</span>
                    <span className="num font-medium">{money(f.aging[b])}</span>
                  </div>
                  <ProgressBar value={f.aging[b] / agingTotal} tone={b === '0-30' ? 'pos' : b === '90+' ? 'neg' : 'copper'} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {tx && <TransactionDialog open onOpenChange={(v) => !v && setTx(null)} preset={{ journal: tx, type: 'in' }} />}
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex justify-between gap-6"><span className="text-ink-3">{p.name}</span><span className="num font-medium">{money(p.value)}</span></p>
      ))}
    </div>
  );
}

/** Roles whose modules arrive in the next stages. */
function RoleHome() {
  const { user } = useAuth();
  const items = navFor(user!.role).flatMap((g) => g.items).filter((i) => i.to !== '/');
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-[22px] font-semibold tracking-tight">Bonjour {user!.name.split(' ')[0]}</h1>
      <p className="mt-1 text-ink-3">Votre espace est en cours de reconstruction. Vos données sont conservées et seront disponibles ici dès la prochaine mise à jour.</p>
      <div className="panel mt-6 divide-y divide-line">
        {items.map((i) => (
          <div key={i.to} className="flex items-center gap-3 px-4 py-3">
            <span className="text-ink-3">{i.icon}</span>
            <span className="flex-1 text-[14px]">{i.label}</span>
            {i.soon ? <Badge>Bientôt</Badge> : <Link to={i.to} className="text-[13px] font-medium text-copper-strong">Ouvrir</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
