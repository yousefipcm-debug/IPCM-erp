// Home for HR and Technique: who is working today, contracts to renew, sites.
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { contractDaysLeft, contractState, fullName, monthKey, useHr } from '@/lib/hr';
import { dateShort } from '@/lib/format';
import { Badge, Button, Panel, Stat } from '@/components/ui/ui';

export function HrHome() {
  const { user } = useAuth();
  const hr = useHr();
  const base = user!.role === 'technique' ? '/technique' : '/rh';
  const month = monthKey();
  const day = new Date().getDate();
  const todayVal = (wid: string) => (hr.attOf(month, wid)?.cells[`${day}_0`]?.val || '').trim().toUpperCase();
  const present = hr.active.reduce((a, w) => a + (todayVal(w.id) === 'P' ? 1 : todayVal(w.id) === 'D' ? 0.5 : 0), 0);
  const notFilled = hr.active.filter((w) => !todayVal(w.id)).length;
  const contracts = hr.active.map((w) => ({ w, st: contractState(w), left: contractDaysLeft(w) }))
    .filter((c) => c.st === 'expired' || c.st === 'urgent' || c.st === 'soon').sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
  const sites = hr.sites.filter((s) => s.status !== 'done');
  const office = hr.active.filter((w) => !hr.siteOf.has(w.id)).length;
  const isHr = user!.role !== 'technique';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Bonjour {user!.name.split(' ')[0]}</h1>
          <p className="mt-0.5 text-ink-3">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex gap-2">
          {isHr && <Link to="/rh/personnel?new=1"><Button icon={<UserPlus className="size-4" />}>Nouvel employé</Button></Link>}
          <Link to={`${base}/pointage`}><Button variant="primary" icon={<ClipboardCheck className="size-4" />}>Pointer aujourd’hui</Button></Link>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Effectif actif" value={hr.active.length} sub={`${office} au bureau, ${hr.active.length - office} sur chantier`} />
        <Stat label="Présents aujourd’hui" value={present} tone="pos" sub={notFilled ? `${notFilled} non pointé(s)` : 'Pointage complet'} />
        <Stat label="Contrats à renouveler" value={contracts.length} tone={contracts.some((c) => c.st !== 'soon') ? 'neg' : undefined} sub="dans les 30 jours ou expirés" />
        <Stat label="Chantiers actifs" value={sites.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {isHr && (
          <Panel title="Contrats" actions={<Link to="/rh/contrats" className="text-[13px] font-medium text-copper-strong">Tout voir</Link>} bodyClassName="p-0">
            {contracts.length === 0 ? <p className="p-4 text-[13.5px] text-ink-3">Aucun contrat n’arrive à échéance dans les 30 prochains jours.</p> : (
              <div className="divide-y divide-line">
                {contracts.slice(0, 8).map(({ w, st, left }) => (
                  <Link key={w.id} to={`/rh/personnel/${w.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sunken/50">
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{fullName(w)}</div><div className="text-[12px] text-ink-3">{w.position}, fin le {dateShort(w.contractEnd)}</div></div>
                    <Badge tone={st === 'soon' ? 'warn' : 'neg'}>{st === 'expired' ? `Expiré depuis ${-(left ?? 0)} j` : `${left} j restants`}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}
        <Panel title="Chantiers" actions={<Link to={`${base}/chantiers`} className="text-[13px] font-medium text-copper-strong">Gérer</Link>} bodyClassName="p-0">
          {sites.length === 0 ? <p className="p-4 text-[13.5px] text-ink-3">Aucun chantier actif.</p> : (
            <div className="divide-y divide-line">
              {sites.map((s) => {
                const p = s.workerIds.reduce((a, id) => a + (todayVal(id) === 'P' ? 1 : todayVal(id) === 'D' ? 0.5 : 0), 0);
                return (
                  <Link key={s.id} to={`${base}/pointage?site=${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sunken/50">
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{s.name}</div><div className="text-[12px] text-ink-3">{s.workerIds.length} employé(s)</div></div>
                    <span className="num text-[13px]"><b className="text-pos">{p}</b><span className="text-ink-3"> / {s.workerIds.length} présents</span></span>
                    <ArrowRight className="size-4 text-ink-3" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
