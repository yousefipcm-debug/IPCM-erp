import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, ArrowLeft, Download, FileSignature, Pencil, Printer, RotateCcw, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { store, stripMeta, updateRecord } from '@/lib/data';
import { age, contractDaysLeft, contractState, emptyWorker, fullName, monthKey, summarize, useHr, type Worker } from '@/lib/hr';
import { dateShort, money, todayISO, monthLabel, capitalize } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import { downloadCsv } from '@/lib/csv';
import type { Rec } from '@/lib/types';
import { Badge, Button, EmptyState, Field, Initials, Input, PageHeader, Panel, SearchInput, Segmented, Select, Stat } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { PrintWorkerDialog, WorkerDialog } from '@/components/hr/workers';

export function contractBadge(w: Worker) {
  const s = contractState(w), d = contractDaysLeft(w);
  if (s === 'expired') return <Badge tone="neg">Expiré depuis {Math.abs(d!)} j</Badge>;
  if (s === 'urgent') return <Badge tone="neg">Fin dans {d} j</Badge>;
  if (s === 'soon') return <Badge tone="warn">Fin dans {d} j</Badge>;
  if (s === 'ok') return <Badge tone="neutral">Jusqu’au {dateShort(w.contractEnd)}</Badge>;
  return <Badge tone="neutral">{w.contractType === 'CDI' ? 'CDI' : 'Sans date de fin'}</Badge>;
}

export function PersonnelPage() {
  const hr = useHr();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [site, setSite] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Rec<Worker> | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => { if (params.get('new')) { setEdit('new'); params.delete('new'); setParams(params, { replace: true }); } }, [params, setParams]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return hr.workers
      .filter((w) => !!w.archived === showArchived)
      .filter((w) => site === 'all' || (site === 'office' ? !hr.siteOf.has(w.id) : hr.siteOf.get(w.id)?.id === site))
      .filter((w) => !s || [fullName(w), w.position, w.socialSecurityNo, w.idCardNo, w.phone].some((v) => (v || '').toLowerCase().includes(s)))
      .map((w) => ({ ...w, siteName: hr.siteOf.get(w.id)?.name || 'Administration' }));
  }, [hr, q, site, showArchived]);

  const active = hr.active;
  const expiring = active.filter((w) => ['expired', 'urgent', 'soon'].includes(contractState(w)));
  const payroll = active.reduce((s, w) => s + (w.netSalary || 0), 0);

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Employé', sort: (w) => fullName(w), cell: (w) => (
      <div className="flex min-w-[200px] items-center gap-2.5">
        {w.photo ? <img src={w.photo} alt="" className="size-8 rounded-full object-cover" /> : <Initials name={fullName(w)} />}
        <div className="min-w-0"><div className="truncate font-medium">{fullName(w)}</div><div className="truncate text-xs text-ink-3">{w.position || 'Fonction non renseignée'}</div></div>
      </div>
    ) },
    { key: 'site', header: 'Affectation', sort: (w) => w.siteName, cell: (w) => <span className="text-ink-2">{w.siteName}</span>, hideOnMobile: true },
    { key: 'age', header: 'Âge', align: 'right', sort: (w) => age(w.birthDate) ?? 0, cell: (w) => <span className="num text-ink-2">{age(w.birthDate) ?? '—'}</span>, hideOnMobile: true },
    { key: 'entry', header: 'Entrée', sort: (w) => w.entryDate, cell: (w) => <span className="num text-ink-2">{dateShort(w.entryDate)}</span>, hideOnMobile: true },
    { key: 'contract', header: 'Contrat', sort: (w) => contractDaysLeft(w) ?? 99999, cell: (w) => <span className="inline-flex items-center gap-2"><span className="text-[13px] text-ink-2">{w.contractType}</span>{contractBadge(w)}</span> },
  ];

  const exportCsv = () => downloadCsv(`personnel_${todayISO()}.csv`, ['Nom', 'Prénom', 'Fonction', 'Affectation', 'Date de naissance', 'Téléphone', 'CNAS', 'Contrat', 'Entrée', 'Fin', 'Net à payer'],
    rows.map((w) => [w.lastName, w.firstName, w.position, w.siteName, w.birthDate, w.phone, w.socialSecurityNo, w.contractType, w.entryDate, w.contractEnd, w.netSalary]));
  const print = () => printDocument({ title: 'Liste du personnel', landscape: true, body: `
    <div class="meta"><span>${printedOn()}</span><span>${rows.length} employé(s)</span></div><h1>Liste du personnel</h1>
    <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Fonction</th><th>Affectation</th><th>Âge</th><th>N° CNAS</th><th>Contrat</th><th>Entrée</th><th>Fin</th></tr></thead><tbody>
    ${rows.map((w, i) => `<tr><td class="c">${i + 1}</td><td>${esc(fullName(w))}</td><td>${esc(w.position)}</td><td>${esc(w.siteName)}</td><td class="c">${age(w.birthDate) ?? ''}</td><td>${esc(w.socialSecurityNo)}</td><td>${esc(w.contractType)}</td><td>${dateShort(w.entryDate)}</td><td>${w.contractEnd ? dateShort(w.contractEnd) : ''}</td></tr>`).join('')}
    </tbody></table>` });

  return (
    <>
      <PageHeader title="Personnel" description="Fiches des employés, affectations et contrats."
        actions={<>
          <Button icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>Importer</Button>
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setEdit('new')}>Nouvel employé</Button>
        </>} />
      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Effectif" value={active.length} sub={`${active.filter((w) => !hr.siteOf.has(w.id)).length} au bureau, ${active.filter((w) => hr.siteOf.has(w.id)).length} sur chantier`} />
        <Stat label="Chantiers actifs" value={hr.sites.filter((s) => s.status !== 'done').length} />
        <Stat label="Contrats à renouveler" value={expiring.length} tone={expiring.length ? 'warn' : undefined} sub="Dans les 30 jours ou expirés" />
        <Stat label="Masse salariale nette" value={money(payroll, { decimals: false })} sub="Par mois, à temps plein" />
      </div>
      <div className="panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Nom, fonction, n° CNAS, téléphone…" className="min-w-[200px] flex-1" />
          <Select value={site} onChange={(e) => setSite(e.target.value)} className="w-auto min-w-[180px]" aria-label="Affectation">
            <option value="all">Toutes les affectations</option><option value="office">Administration</option>
            {hr.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Segmented size="sm" value={showArchived ? 'arch' : 'act'} onChange={(v) => setShowArchived(v === 'arch')} options={[{ value: 'act', label: 'En poste' }, { value: 'arch', label: 'Anciens' }]} />
          <Button icon={<Download className="size-4" />} disabled={!rows.length} onClick={exportCsv}>Excel</Button>
          <Button icon={<Printer className="size-4" />} disabled={!rows.length} onClick={print}>Imprimer</Button>
        </div>
        <DataTable rows={rows} columns={cols} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(w) => nav(`/rh/personnel/${w.id}`)}
          empty={<EmptyState icon={<Users className="size-5" />} title={q ? 'Aucun résultat' : showArchived ? 'Aucun ancien employé' : 'Aucun employé'}
            action={!q && !showArchived && <Button variant="primary" onClick={() => setEdit('new')}>Ajouter un employé</Button>} />} />
      </div>
      {edit && <WorkerDialog record={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={(id) => edit === 'new' && nav(`/rh/personnel/${id}`)} />}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </>
  );
}

export function WorkerPage() {
  const { id } = useParams();
  const hr = useHr();
  const nav = useNavigate();
  const confirm = useConfirm();
  const w = hr.workers.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [print, setPrint] = useState(false);
  const [renew, setRenew] = useState(false);
  if (!w) return <EmptyState title="Employé introuvable" action={<Button onClick={() => nav('/rh/personnel')}>Retour au personnel</Button>} />;
  const site = hr.siteOf.get(w.id);
  const month = monthKey();
  const months = [month, ...[-1, -2].map((n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return monthKey(d); })];

  const archive = async () => {
    if (!(await confirm({ title: `Retirer ${fullName(w)} du personnel ?`, message: 'L’employé passe dans « Anciens ». Sa fiche, son pointage et son historique sont conservés, et vous pourrez le réintégrer.', confirmLabel: 'Retirer du personnel' }))) return;
    const ops: any[] = [{ op: 'update', collection: 'workers', id: w.id, version: w._v, data: { ...stripMeta(w), archived: true } }];
    if (site) ops.push({ op: 'update', collection: 'workSites', id: site.id, version: site._v, data: { ...stripMeta(site), workerIds: site.workerIds.filter((x) => x !== w.id) } });
    await store.mutate(ops); toast.success(`${fullName(w)} retiré du personnel`);
  };
  const remove = async () => {
    const hasAtt = [...hr.att.values()].some((a) => a.workerId === w.id);
    if (!(await confirm({ title: `Supprimer définitivement ${fullName(w)} ?`, danger: true, confirmLabel: 'Supprimer',
      message: hasAtt ? 'Son pointage sera conservé mais n’apparaîtra plus. Préférez « Retirer du personnel » pour garder l’historique.' : 'La fiche sera supprimée.' }))) return;
    const ops: any[] = [{ op: 'delete', collection: 'workers', id: w.id }];
    if (site) ops.push({ op: 'update', collection: 'workSites', id: site.id, version: site._v, data: { ...stripMeta(site), workerIds: site.workerIds.filter((x) => x !== w.id) } });
    await store.mutate(ops); toast.success('Fiche supprimée'); nav('/rh/personnel');
  };

  const info: [string, React.ReactNode][] = [
    ['Fonction', w.position], ['Affectation', site ? <Link className="text-copper-strong hover:underline" to="/rh/chantiers">{site.name}</Link> : 'Administration (bureau)'],
    ['Date de naissance', w.birthDate ? `${dateShort(w.birthDate)} (${age(w.birthDate)} ans)` : ''], ['Téléphone', w.phone && <a className="num hover:underline" href={`tel:${w.phone}`}>{w.phone}</a>],
    ['Adresse', w.address], ['Carte d’identité', w.idCardNo && `${w.idCardNo}${w.idCardExpiry ? `, expire le ${dateShort(w.idCardExpiry)}` : ''}`],
    ['N° CNAS', w.socialSecurityNo], ['Situation familiale', `${w.maritalStatus || '—'}, ${w.children || 0} enfant(s)`],
    ['Groupe sanguin', w.bloodGroup], ['Santé', w.health], ['Certificats', w.certificates],
  ];

  return (
    <>
      <Link to="/rh/personnel" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"><ArrowLeft className="size-4" />Personnel</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {w.photo ? <img src={w.photo} alt="" className="size-20 rounded-xl object-cover" /> : <Initials name={fullName(w)} className="size-20 text-xl" />}
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{fullName(w)}</h1>
            <p className="text-ink-3">{w.position || 'Fonction non renseignée'}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{w.archived ? <Badge tone="neg">Ancien employé</Badge> : contractBadge(w)}<Badge>{w.contractType}</Badge></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Printer className="size-4" />} onClick={() => setPrint(true)}>Imprimer la fiche</Button>
          <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Modifier</Button>
          <RowMenu label="Plus d’actions" items={[
            !w.archived && { label: 'Renouveler le contrat', icon: <FileSignature />, onSelect: () => setRenew(true) },
            !w.archived ? { label: 'Retirer du personnel', icon: <Archive />, onSelect: archive } : { label: 'Réintégrer', icon: <RotateCcw />, onSelect: () => updateRecord('workers', w as any, { archived: false } as any) },
            { label: 'Supprimer la fiche', icon: <Trash2 />, danger: true, onSelect: remove },
          ]} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel title="Informations">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {info.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-ink-3">{k}</dt><dd className="text-[14px]">{v || <span className="text-ink-3">—</span>}</dd></div>)}
            </dl>
          </Panel>
          <Panel title="Pointage récent" actions={<Link to="/rh/pointage" className="text-[13px] font-medium text-copper-strong hover:underline">Ouvrir le pointage</Link>} bodyClassName="p-0">
            <table className="w-full text-[13.5px]">
              <thead><tr className="border-b border-line text-[12.5px] text-ink-3"><th className="h-9 px-4 text-left font-medium">Mois</th><th className="px-3 text-right font-medium">Jours</th><th className="px-3 text-right font-medium">Heures sup.</th><th className="px-3 text-right font-medium">Absences</th><th className="px-4 text-right font-medium">Salaire estimé</th></tr></thead>
              <tbody>{months.map((m) => {
                const s = summarize(hr.attOf(m, w.id), m);
                const div = site ? 26 : 22;
                return <tr key={m} className="border-b border-line last:border-0"><td className="h-10 px-4">{capitalize(monthLabel(m))}</td><td className="num px-3 text-right">{s.days}</td><td className="num px-3 text-right">{s.extra || '—'}</td><td className="num px-3 text-right">{s.absent || '—'}</td><td className="num px-4 text-right">{w.netSalary && s.days ? money((w.netSalary / div) * s.days) : '—'}</td></tr>;
              })}</tbody>
            </table>
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Contrat">
            <dl className="space-y-2.5 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-ink-3">Type</dt><dd>{w.contractType}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Entrée</dt><dd className="num">{dateShort(w.entryDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Fin</dt><dd className="num">{w.contractEnd ? dateShort(w.contractEnd) : '—'}</dd></div>
            </dl>
            {!w.archived && <Button className="mt-4 w-full" icon={<FileSignature className="size-4" />} onClick={() => setRenew(true)}>Renouveler le contrat</Button>}
            {(w.contractHistory || []).length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-[13px] font-semibold">Contrats précédents</p>
                <ul className="space-y-1.5 text-[13px]">{[...w.contractHistory].reverse().map((h, i) => <li key={i} className="flex justify-between gap-2"><span className="text-ink-2">{h.type || 'Contrat'}</span><span className="num text-ink-3">{dateShort(h.from)} au {dateShort(h.to)}</span></li>)}</ul>
              </div>
            )}
          </Panel>
          <Panel title="Rémunération">
            <dl className="space-y-2.5 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-ink-3">Salaire de base</dt><dd className="num">{w.baseSalary ? money(w.baseSalary) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Net à payer</dt><dd className="num font-medium">{w.netSalary ? money(w.netSalary) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">RIP</dt><dd className="num truncate">{w.rib || '—'}</dd></div>
            </dl>
          </Panel>
        </aside>
      </div>
      {edit && <WorkerDialog record={w} onClose={() => setEdit(false)} />}
      {print && <PrintWorkerDialog worker={w} siteName={site?.name || 'Administration'} onClose={() => setPrint(false)} />}
      {renew && <RenewDialog worker={w} onClose={() => setRenew(false)} />}
    </>
  );
}

export function RenewDialog({ worker, onClose }: { worker: Rec<Worker>; onClose: () => void }) {
  const start = worker.contractEnd || todayISO();
  const plus = (iso: string, months: number) => { const d = new Date(iso); d.setMonth(d.getMonth() + months); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
  const [f, setF] = useState({ type: worker.contractType || 'CDD', from: start, to: plus(start, 12) });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await updateRecord('workers', worker as any, {
        contractHistory: [...(worker.contractHistory || []), { from: worker.entryDate, to: worker.contractEnd, type: worker.contractType }],
        contractType: f.type, entryDate: f.from, contractEnd: f.type === 'CDI' ? '' : f.to,
      } as any);
      toast.success('Contrat renouvelé', { description: `${fullName(worker)}, ${f.type}${f.type !== 'CDI' ? ` jusqu’au ${dateShort(f.to)}` : ''}` });
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="sm" title={`Renouveler le contrat de ${fullName(worker)}`}
      description="Le contrat actuel est archivé dans l’historique de la fiche."
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Renouveler</Button></>}>
      <div className="space-y-3.5">
        <Field label="Type de contrat"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['CDI', 'CDD', 'CTA', 'Stage', 'Autre'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Début"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        {f.type !== 'CDI' && (
          <Field label="Fin">
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <div className="mt-2 flex gap-1.5">{[3, 6, 12, 24].map((m) => <Button key={m} size="sm" onClick={() => setF({ ...f, to: plus(f.from, m) })}>{m} mois</Button>)}</div>
          </Field>
        )}
      </div>
    </Dialog>
  );
}

export function ContractsPage() {
  const hr = useHr();
  const nav = useNavigate();
  const [renew, setRenew] = useState<Rec<Worker> | null>(null);
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  const rows = hr.active.filter((w) => filter === 'all' || ['expired', 'urgent', 'soon'].includes(contractState(w)))
    .map((w) => ({ ...w, siteName: hr.siteOf.get(w.id)?.name || 'Administration' }));
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Employé', sort: (w) => fullName(w), cell: (w) => <div><div className="font-medium">{fullName(w)}</div><div className="text-xs text-ink-3">{w.position} {w.siteName && `, ${w.siteName}`}</div></div> },
    { key: 'type', header: 'Contrat', cell: (w) => w.contractType },
    { key: 'from', header: 'Début', sort: (w) => w.entryDate, cell: (w) => <span className="num text-ink-2">{dateShort(w.entryDate)}</span>, hideOnMobile: true },
    { key: 'to', header: 'Fin', sort: (w) => contractDaysLeft(w) ?? 99999, cell: (w) => contractBadge(w) },
    { key: 'a', header: '', align: 'right', cell: (w) => <Button size="sm" onClick={(e) => { e.stopPropagation(); setRenew(w); }}>Renouveler</Button> },
  ];
  return (
    <>
      <PageHeader title="Contrats" description="Contrats qui arrivent à échéance dans les 30 jours ou déjà expirés." actions={<Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'todo', label: `À traiter (${hr.active.filter((w) => ['expired', 'urgent', 'soon'].includes(contractState(w))).length})` }, { value: 'all', label: 'Tous' }]} />} />
      <div className="panel">
        <DataTable rows={rows} columns={cols} initialSort={{ key: 'to', dir: 'asc' }} onRowClick={(w) => nav(`/rh/personnel/${w.id}`)}
          empty={<EmptyState icon={<FileSignature className="size-5" />} title="Aucun contrat à renouveler">Les contrats arrivant à échéance dans les 30 jours apparaîtront ici.</EmptyState>} />
      </div>
      {renew && <RenewDialog worker={renew} onClose={() => setRenew(null)} />}
    </>
  );
}

// ───────── CSV import (columns detected by name; "prénom" no longer swallowed by "nom") ─────────
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const MAP: [RegExp, keyof Worker][] = [
  [/^prenom/, 'firstName'], [/^(nom|name)$/, 'lastName'], [/^nom/, 'lastName'], [/naiss/, 'birthDate'], [/fonct|poste/, 'position'],
  [/entree|embauche/, 'entryDate'], [/fin/, 'contractEnd'], [/contrat/, 'contractType'], [/civil|famil/, 'maritalStatus'],
  [/assur|cnas|secu|ss$/, 'socialSecurityNo'], [/tel|phone/, 'phone'], [/adresse/, 'address'], [/net|salaire/, 'netSalary'], [/cin|carte/, 'idCardNo'],
];
function toISO(v: string) { const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v; }

function ImportDialog({ onClose }: { onClose: () => void }) {
  const hr = useHr();
  const [rows, setRows] = useState<Worker[] | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const read = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const head = lines[0].split(sep).map((h) => norm(h));
    const keys = head.map((h) => MAP.find(([re]) => re.test(h))?.[1] ?? null);
    const out = lines.slice(1).map((l) => {
      const cells = l.split(sep);
      const w = emptyWorker();
      keys.forEach((k, i) => { if (!k) return; const v = (cells[i] || '').trim(); (w as any)[k] = k === 'netSalary' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) || 0 : /Date|End/.test(k) ? toISO(v) : v; });
      w.lastName = w.lastName.toUpperCase();
      return w;
    }).filter((w) => w.lastName && w.firstName);
    setRows(out);
  };
  const exists = (w: Worker) => hr.workers.some((x) => fullName(x) === fullName(w));
  const save = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const fresh = rows.filter((w) => !exists(w));
      if (fresh.length) await store.mutate(fresh.map((w) => ({ op: 'create' as const, collection: 'workers' as const, data: w })));
      toast.success(`${fresh.length} employé(s) importé(s)`, { description: rows.length - fresh.length ? `${rows.length - fresh.length} déjà présent(s), ignoré(s)` : undefined });
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} size="lg" title="Importer du personnel" description="Fichier Excel enregistré en CSV. Colonnes reconnues : Nom, Prénom, Date de naissance, Fonction, Date d’entrée, Fin de contrat, Contrat, N° CNAS, Téléphone, Adresse, Net à payer."
      footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" loading={busy} disabled={!rows?.length} onClick={save}>Importer {rows ? rows.filter((w) => !exists(w)).length : ''} employé(s)</Button></>}>
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      <Button icon={<Upload className="size-4" />} onClick={() => ref.current?.click()}>Choisir un fichier CSV</Button>
      {rows && (rows.length === 0 ? <p className="mt-4 text-[13px] text-neg">Aucune ligne avec un nom et un prénom n’a été trouvée. Vérifiez les titres de colonnes.</p> : (
        <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {rows.map((w, i) => <li key={i} className="flex items-center justify-between px-3 py-2 text-[13.5px]"><span>{fullName(w)} <span className="text-ink-3">{w.position}</span></span>{exists(w) ? <Badge>Déjà présent</Badge> : <Badge tone="pos">Nouveau</Badge>}</li>)}
        </ul>
      ))}
    </Dialog>
  );
}

