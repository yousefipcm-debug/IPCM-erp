import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Printer, Trash2 } from 'lucide-react';
import { createRecord, saveChanges, store, stripMeta } from '@/lib/data';
import { emptyWorker, fullName, useHr, type Worker } from '@/lib/hr';
import { fileToCompressedDataUrl } from '@/lib/image';
import { dateLong, money } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { Rec } from '@/lib/types';
import { Dialog } from '../ui/dialog';
import { Button, Checkbox, Field, Input, Select, Textarea } from '../ui/ui';
import { MoneyInput } from '../ui/pickers';

const OFFICE = '__office';

export function WorkerDialog({ record, onClose, onSaved }: { record: Rec<Worker> | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const hr = useHr();
  const currentSite = record ? hr.siteOf.get(record.id)?.id ?? OFFICE : OFFICE;
  const [initial] = useState<Worker>(() => (record ? stripMeta(record) : emptyWorker()));
  const [f, setF] = useState<Worker>(initial);
  const [site, setSite] = useState(currentSite);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Worker>(k: K) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try { setF((x) => ({ ...x, photo: null })); const url = await fileToCompressedDataUrl(file, 480); setF((x) => ({ ...x, photo: url })); }
    catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.lastName.trim()) e.lastName = 'Le nom est requis.';
    if (!f.firstName.trim()) e.firstName = 'Le prénom est requis.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const data: Worker = { ...f, lastName: f.lastName.trim().toUpperCase(), firstName: f.firstName.trim(), children: Number(f.children) || 0 };
      let id = record?.id;
      if (record) await saveChanges('workers', record as any, initial as any, data as any);
      else id = await createRecord('workers', data as any);
      // Assignment: a worker belongs to one site at most. Move them in a single atomic batch.
      if (site !== currentSite || !record) {
        const ops: any[] = [];
        for (const s of hr.sites) {
          const has = (s.workerIds || []).includes(id!);
          const should = s.id === site;
          if (has !== should) {
            const latest: any = store.get('workSites', s.id) ?? s;
            ops.push({ op: 'update', collection: 'workSites', id: s.id, version: latest._v, data: { ...stripMeta(latest), workerIds: should ? [...(latest.workerIds || []), id] : (latest.workerIds || []).filter((x: string) => x !== id) } });
          }
        }
        if (ops.length) await store.mutate(ops);
      }
      toast.success(record ? 'Fiche enregistrée' : `${fullName(data)} ajouté au personnel`);
      onSaved?.(id!);
      onClose();
    } catch { /* toast shown */ } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="xl" title={record ? `Fiche de ${fullName(record)}` : 'Nouvel employé'}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>{record ? 'Enregistrer' : 'Ajouter l’employé'}</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[150px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative grid h-[180px] w-[140px] place-items-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface-2 text-ink-3 hover:border-copper" aria-label="Choisir une photo">
            {f.photo ? <img src={f.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs"><Camera className="size-5" />Photo</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          {f.photo && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setF((x) => ({ ...x, photo: null }))}>Retirer</Button>}
        </div>
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-[13px] font-semibold">Identité</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nom" required error={err.lastName}><Input value={f.lastName} onChange={set('lastName')} placeholder="BENMESSAOUD" /></Field>
              <Field label="Prénom" required error={err.firstName}><Input value={f.firstName} onChange={set('firstName')} placeholder="Amine" /></Field>
              <Field label="Date de naissance"><Input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
              <Field label="N° de carte d’identité"><Input className="num" value={f.idCardNo} onChange={set('idCardNo')} /></Field>
              <Field label="Expiration de la carte"><Input type="date" value={f.idCardExpiry} onChange={set('idCardExpiry')} /></Field>
              <Field label="Téléphone"><Input type="tel" className="num" value={f.phone} onChange={set('phone')} placeholder="0550 12 34 56" /></Field>
              <Field label="Situation familiale"><Select value={f.maritalStatus} onChange={set('maritalStatus')}>{['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Enfants"><Input type="number" min={0} value={f.children} onChange={(e) => setF((x) => ({ ...x, children: Math.max(0, +e.target.value || 0) }))} /></Field>
              <Field label="Groupe sanguin"><Select value={f.bloodGroup} onChange={set('bloodGroup')}><option value="">Non renseigné</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Situation de santé"><Select value={f.health} onChange={set('health')}>{[['Bonne', 'Bonne'], ['Chronique', 'Maladie chronique'], ['Handicap', 'Handicap'], ['Autre', 'Autre']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Adresse" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
            </div>
          </section>
          <section>
            <p className="mb-2 text-[13px] font-semibold">Poste et contrat</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fonction"><Input value={f.position} onChange={set('position')} placeholder="ex. Soudeur" /></Field>
              <Field label="Affectation" hint={site === OFFICE ? 'Repos vendredi et samedi, salaire ÷ 22' : 'Repos vendredi, salaire ÷ 26'}>
                <Select value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value={OFFICE}>Administration (bureau)</option>
                  {hr.sites.filter((s) => s.status !== 'done' || s.id === site).map((s) => <option key={s.id} value={s.id}>Chantier : {s.name}</option>)}
                </Select>
              </Field>
              <Field label="N° de sécurité sociale (CNAS)"><Input className="num" value={f.socialSecurityNo} onChange={set('socialSecurityNo')} /></Field>
              <Field label="Type de contrat"><Select value={f.contractType} onChange={set('contractType')}>{['CDI', 'CDD', 'CTA', 'Stage', 'Autre'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Date d’entrée"><Input type="date" value={f.entryDate} onChange={set('entryDate')} /></Field>
              <Field label="Fin de contrat" hint={f.contractType === 'CDI' ? 'Laissez vide pour un CDI.' : undefined}><Input type="date" value={f.contractEnd} onChange={set('contractEnd')} /></Field>
              <Field label="Certificats et attestations" className="sm:col-span-3"><Textarea rows={2} value={f.certificates} onChange={set('certificates')} placeholder="ex. Certificat de soudure, habilitation électrique…" /></Field>
            </div>
          </section>
          <section>
            <p className="mb-2 text-[13px] font-semibold">Rémunération</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Salaire de base"><MoneyInput value={f.baseSalary} onChange={(n) => setF((x) => ({ ...x, baseSalary: n }))} /></Field>
              <Field label="Net à payer par mois" hint="Base du calcul des salaires selon le pointage."><MoneyInput value={f.netSalary} onChange={(n) => setF((x) => ({ ...x, netSalary: n }))} /></Field>
              <Field label="RIP / compte"><Input className="num" value={f.rib} onChange={set('rib')} /></Field>
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  );
}

const PRINT_FIELDS: { key: string; label: string; group: string; def: boolean }[] = [
  { key: 'photo', label: 'Photo', group: 'Identité', def: true },
  { key: 'birth', label: 'Date de naissance', group: 'Identité', def: true },
  { key: 'idcard', label: 'Carte d’identité', group: 'Identité', def: true },
  { key: 'phone', label: 'Téléphone', group: 'Identité', def: true },
  { key: 'address', label: 'Adresse', group: 'Identité', def: true },
  { key: 'family', label: 'Situation familiale et enfants', group: 'Identité', def: true },
  { key: 'blood', label: 'Groupe sanguin', group: 'Identité', def: true },
  { key: 'health', label: 'Situation de santé', group: 'Identité', def: false },
  { key: 'position', label: 'Fonction et affectation', group: 'Poste', def: true },
  { key: 'cnas', label: 'N° de sécurité sociale', group: 'Poste', def: true },
  { key: 'contract', label: 'Contrat', group: 'Poste', def: true },
  { key: 'certs', label: 'Certificats', group: 'Poste', def: true },
  { key: 'base', label: 'Salaire de base', group: 'Rémunération', def: false },
  { key: 'net', label: 'Net à payer', group: 'Rémunération', def: false },
  { key: 'rib', label: 'RIP', group: 'Rémunération', def: true },
];

export function PrintWorkerDialog({ worker, siteName, onClose }: { worker: Rec<Worker>; siteName: string; onClose: () => void }) {
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(PRINT_FIELDS.map((p) => [p.key, p.def])));
  const groups = useMemo(() => [...new Set(PRINT_FIELDS.map((p) => p.group))], []);
  const go = () => {
    const w = worker;
    const row = (l: string, v: unknown) => `<tr><th style="width:38%">${l}</th><td>${esc(v || '—')}</td></tr>`;
    const rows: string[] = [row('Nom', w.lastName), row('Prénom', w.firstName)];
    if (sel.birth) rows.push(row('Date de naissance', w.birthDate ? dateLong(w.birthDate) : ''));
    if (sel.idcard) rows.push(row('N° de carte d’identité', `${w.idCardNo || ''}${w.idCardExpiry ? ` (expire le ${dateLong(w.idCardExpiry)})` : ''}`));
    if (sel.phone) rows.push(row('Téléphone', w.phone));
    if (sel.address) rows.push(row('Adresse', w.address));
    if (sel.family) rows.push(row('Situation familiale', `${w.maritalStatus || ''}, ${w.children || 0} enfant(s)`));
    if (sel.blood) rows.push(row('Groupe sanguin', w.bloodGroup));
    if (sel.health) rows.push(row('Situation de santé', w.health));
    if (sel.position) { rows.push(row('Fonction', w.position)); rows.push(row('Affectation', siteName)); }
    if (sel.cnas) rows.push(row('N° de sécurité sociale', w.socialSecurityNo));
    if (sel.contract) rows.push(row('Contrat', `${w.contractType || ''}, du ${w.entryDate ? dateLong(w.entryDate) : '…'} au ${w.contractEnd ? dateLong(w.contractEnd) : '…'}`));
    if (sel.certs) rows.push(row('Certificats et attestations', w.certificates));
    if (sel.base) rows.push(row('Salaire de base', w.baseSalary ? money(w.baseSalary) : ''));
    if (sel.net) rows.push(row('Net à payer', w.netSalary ? money(w.netSalary) : ''));
    if (sel.rib) rows.push(row('RIP', w.rib));
    printDocument({ title: `Fiche ${fullName(w)}`, extraCss: '.top{display:flex;gap:18px;align-items:flex-start}.ph{width:110px;height:140px;border:1px solid #bbb;object-fit:cover;flex-shrink:0}th{background:#f6f7f8}', body: `
      <div class="meta"><span>${printedOn()}</span></div>
      <h1>Fiche de l’employé</h1>
      <div class="top"><table>${rows.join('')}</table>${sel.photo && w.photo ? `<img class="ph" src="${w.photo}" alt="">` : ''}</div>
      <div class="sig"><div><div class="line">L’intéressé(e)</div></div><div><div class="line">La Direction</div></div></div>` });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} size="sm" title="Imprimer la fiche" description="Choisissez les informations à faire figurer."
      footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" icon={<Printer className="size-4" />} onClick={go}>Imprimer</Button></>}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" onClick={() => setSel(Object.fromEntries(PRINT_FIELDS.map((p) => [p.key, true])))}>Tout cocher</Button>
        <Button size="sm" onClick={() => setSel(Object.fromEntries(PRINT_FIELDS.map((p) => [p.key, false])))}>Tout décocher</Button>
      </div>
      {groups.map((g) => (
        <div key={g} className="mb-3">
          <p className="mb-1.5 text-[13px] font-semibold">{g}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PRINT_FIELDS.filter((p) => p.group === g).map((p) => <Checkbox key={p.key} checked={!!sel[p.key]} onChange={(v) => setSel((s) => ({ ...s, [p.key]: v }))} label={p.label} />)}
          </div>
        </div>
      ))}
    </Dialog>
  );
}
