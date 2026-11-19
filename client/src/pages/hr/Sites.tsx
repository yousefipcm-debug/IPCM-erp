import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardCheck, HardHat, Pencil, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { createRecord, store, stripMeta } from '@/lib/data';
import { fullName, monthKey, summarize, useHr, type WorkSite } from '@/lib/hr';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { Rec } from '@/lib/types';
import { Badge, Button, Checkbox, EmptyState, Field, Initials, Input, PageHeader, SearchInput, Segmented } from '@/components/ui/ui';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';

export function SitesPage({ base = '/rh' }: { base?: string }) {
  const hr = useHr();
  const confirm = useConfirm();
  const [status, setStatus] = useState<'active' | 'done'>('active');
  const [edit, setEdit] = useState<Rec<WorkSite> | 'new' | null>(null);
  const list = hr.sites.filter((s) => (s.status || 'active') === status);
  const office = hr.active.filter((w) => !hr.siteOf.has(w.id));
  const month = monthKey();
  const today = new Date().getDate();

  const setStatusOf = async (s: Rec<WorkSite>, st: 'active' | 'done') => {
    if (st === 'done' && s.workerIds.length && !(await confirm({ title: `Clôturer le chantier ${s.name} ?`, message: `Les ${s.workerIds.length} employé(s) affectés reviennent à l’administration. Le pointage passé est conservé.`, confirmLabel: 'Clôturer' }))) return;
    await store.mutate([{ op: 'update', collection: 'workSites', id: s.id, version: s._v, data: { ...stripMeta(s), status: st, workerIds: st === 'done' ? [] : s.workerIds } }]);
    toast.success(st === 'done' ? 'Chantier clôturé' : 'Chantier rouvert');
  };
  const remove = async (s: Rec<WorkSite>) => {
    if (!(await confirm({ title: `Supprimer le chantier ${s.name} ?`, message: 'Les employés affectés reviennent à l’administration. Préférez « Clôturer » pour garder une trace.', danger: true, confirmLabel: 'Supprimer' }))) return;
    await store.mutate([{ op: 'delete', collection: 'workSites', id: s.id }]); toast.success('Chantier supprimé');
  };
  const print = () => printDocument({ title: 'Affectation du personnel', body: `
    <div class="meta"><span>${printedOn()}</span></div><h1>Affectation du personnel par chantier</h1>
    ${[...hr.sites.filter((s) => s.status !== 'done'), { name: 'Administration (bureau)', description: '', workerIds: office.map((w) => w.id) } as any].map((s: any) => `
      <h2>${esc(s.name)} (${s.workerIds.length})</h2>${s.description ? `<p class="muted">${esc(s.description)}</p>` : ''}
      <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Fonction</th><th>Contrat</th><th>Téléphone</th></tr></thead><tbody>
      ${s.workerIds.map((id: string, i: number) => { const w = hr.workers.find((x) => x.id === id); return w ? `<tr><td class="c">${i + 1}</td><td>${esc(fullName(w))}</td><td>${esc(w.position)}</td><td>${esc(w.contractType)}</td><td>${esc(w.phone)}</td></tr>` : ''; }).join('') || '<tr><td colspan="5" class="c muted">Aucun employé</td></tr>'}
      </tbody></table>`).join('')}` });

  return (
    <>
      <PageHeader title="Chantiers" description="Chaque employé est affecté à un seul chantier, ou à l’administration."
        actions={<><Button icon={<Printer className="size-4" />} onClick={print}>Imprimer les affectations</Button><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>Nouveau chantier</Button></>} />
      <div className="mb-3"><Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'active', label: `En cours (${hr.sites.filter((s) => s.status !== 'done').length})` }, { value: 'done', label: 'Clôturés' }]} /></div>
      {list.length === 0 ? <div className="panel"><EmptyState icon={<HardHat className="size-5" />} title={status === 'active' ? 'Aucun chantier en cours' : 'Aucun chantier clôturé'} action={status === 'active' && <Button variant="primary" onClick={() => setEdit('new')}>Créer un chantier</Button>}>Créez un chantier puis affectez-y le personnel pour suivre son pointage.</EmptyState></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((s) => {
            const ws = s.workerIds.map((id) => hr.workers.find((w) => w.id === id)).filter(Boolean) as any[];
            const present = ws.filter((w) => (hr.attOf(month, w.id)?.cells[`${today}_0`]?.val || '').toUpperCase() === 'P').length;
            const days = ws.reduce((t, w) => t + summarize(hr.attOf(month, w.id), month).days, 0);
            return (
              <article key={s.id} className="panel flex flex-col">
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0"><h3 className="truncate text-[15px] font-semibold">{s.name}</h3><p className="truncate text-[12.5px] text-ink-3">{s.description || 'Sans description'}</p></div>
                  <div className="flex items-center gap-1">
                    {s.status === 'done' ? <Badge>Clôturé</Badge> : <Badge tone="pos">{present} présent(s) aujourd’hui</Badge>}
                    <RowMenu items={[
                      { label: 'Modifier et affecter', icon: <Pencil />, onSelect: () => setEdit(s) },
                      s.status !== 'done' ? { label: 'Clôturer le chantier', icon: <CheckCircle2 />, onSelect: () => setStatusOf(s, 'done') } : { label: 'Rouvrir', icon: <RotateCcw />, onSelect: () => setStatusOf(s, 'active') },
                      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(s) },
                    ]} />
                  </div>
                </header>
                <div className="flex-1 px-4 py-3">
                  {ws.length === 0 ? <p className="text-[13px] text-ink-3">Aucun employé affecté.</p> : (
                    <ul className="flex flex-wrap gap-1.5">
                      {ws.map((w) => <li key={w.id}><Link to={`/rh/personnel/${w.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-2.5 pl-0.5 text-[12.5px] hover:border-line-strong">{w.photo ? <img src={w.photo} alt="" className="size-6 rounded-full object-cover" /> : <Initials name={fullName(w)} className="size-6 text-[10px]" />}{fullName(w)}</Link></li>)}
                    </ul>
                  )}
                </div>
                <footer className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px]">
                  <span className="text-ink-3">{ws.length} employé(s), {days} jour(s) pointé(s) ce mois-ci</span>
                  <Link to={`${base}/pointage?site=${s.id}`} className="inline-flex items-center gap-1.5 font-medium text-copper-strong hover:underline"><ClipboardCheck className="size-4" />Pointage</Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {status === 'active' && office.length > 0 && <p className="mt-4 text-[13px] text-ink-3">{office.length} employé(s) à l’administration, sans chantier.</p>}
      {edit && <SiteDialog record={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SiteDialog({ record, onClose }: { record: Rec<WorkSite> | null; onClose: () => void }) {
  const hr = useHr();
  const [name, setName] = useState(record?.name || '');
  const [desc, setDesc] = useState(record?.description || '');
  const [sel, setSel] = useState<Set<string>>(() => new Set(record?.workerIds || []));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useMemo(() => hr.active.filter((w) => !q || fullName(w).toLowerCase().includes(q.toLowerCase()) || (w.position || '').toLowerCase().includes(q.toLowerCase())), [hr.active, q]);
  const moving = [...sel].filter((id) => { const s = hr.siteOf.get(id); return s && s.id !== record?.id; });

  const save = async () => {
    if (!name.trim()) return setErr('Donnez un nom au chantier.');
    setBusy(true);
    try {
      const workerIds = [...sel];
      let id = record?.id;
      const ops: any[] = [];
      if (record) { const latest: any = store.get('workSites', record.id) ?? record; ops.push({ op: 'update', collection: 'workSites', id: record.id, version: latest._v, data: { ...stripMeta(latest), name: name.trim(), description: desc.trim(), workerIds } }); }
      else { id = await createRecord('workSites', { name: name.trim(), description: desc.trim(), workerIds, status: 'active' } as any); }
      // A worker belongs to one site: remove the selected workers from every other site.
      for (const s of hr.sites) {
        if (s.id === id) continue;
        const keep = (s.workerIds || []).filter((w) => !sel.has(w));
        if (keep.length !== (s.workerIds || []).length) { const latest: any = store.get('workSites', s.id) ?? s; ops.push({ op: 'update', collection: 'workSites', id: s.id, version: latest._v, data: { ...stripMeta(latest), workerIds: keep } }); }
      }
      if (ops.length) await store.mutate(ops);
      toast.success(record ? 'Chantier enregistré' : 'Chantier créé');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="lg" title={record ? `Chantier ${record.name}` : 'Nouveau chantier'}
      footer={<><span className="mr-auto self-center text-[13px] text-ink-3">{sel.size} employé(s) sélectionné(s)</span><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nom du chantier" required error={err}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Centre commercial Blida" /></Field>
        <Field label="Lieu ou description"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex. Zone industrielle, lot 4" /></Field>
      </div>
      <p className="mt-5 mb-2 text-[13px] font-semibold">Personnel affecté</p>
      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un employé…" />
      <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {list.map((w) => {
          const other = hr.siteOf.get(w.id);
          return (
            <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <Checkbox checked={sel.has(w.id)} onChange={(v) => setSel((s) => { const n = new Set(s); v ? n.add(w.id) : n.delete(w.id); return n; })}
                label={<span>{fullName(w)} <span className="text-ink-3">{w.position}</span></span>} />
              {other && other.id !== record?.id && <span className="shrink-0 text-xs text-ink-3">sur {other.name}</span>}
            </li>
          );
        })}
      </ul>
      {moving.length > 0 && <p className="mt-2 text-[13px] text-warn">{moving.length} employé(s) quitteront leur chantier actuel pour celui-ci.</p>}
    </Dialog>
  );
}
