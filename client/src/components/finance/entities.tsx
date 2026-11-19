import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createRecord, saveChanges, useCollection } from '@/lib/data';
import type { Client, Rec, Supplier } from '@/lib/types';
import { Dialog } from '../ui/dialog';
import { Button, Field, Input, Select, Textarea } from '../ui/ui';
import { MoneyInput, Picker, type PickOption } from '../ui/pickers';

export const emptyClient = (name = ''): Client => ({ name, legalName: '', address: '', nif: '', nis: '', rc: '', ai: '', tin: '', contactPerson: '', phone: '', phone2: '', email: '', paymentTerms: '', rib: '', activity: '', notes: '' });
export const emptySupplier = (name = ''): Supplier => ({ name, legalName: '', address: '', nif: '', nis: '', rc: '', contactPerson: '', phone: '', phone2: '', email: '', paymentTerms: '', rib: '', activity: '', notes: '', alertLimit: 0 });

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

export async function quickCreateClient(name: string, existing: Rec<Client>[]) {
  const dup = existing.find((c) => norm(c.name) === norm(name));
  if (dup) return dup.id;
  const id = await createRecord('clients', emptyClient(name.trim()));
  toast.success(`Client « ${name.trim()} » créé`);
  return id;
}
export async function quickCreateSupplier(name: string, existing: Rec<Supplier>[]) {
  const dup = existing.find((c) => norm(c.name) === norm(name));
  if (dup) return dup.id;
  const id = await createRecord('suppliers', emptySupplier(name.trim()));
  toast.success(`Fournisseur « ${name.trim()} » créé`);
  return id;
}

export function ClientPicker({ value, onChange, allowClear, invalid, id }: { value: string | null; onChange: (v: string | null) => void; allowClear?: boolean; invalid?: boolean; id?: string }) {
  const clients = useCollection('clients');
  const options = useMemo<PickOption[]>(() => clients.map((c) => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr')), [clients]);
  return <Picker value={value} onChange={onChange} options={options} placeholder="Choisir un client" allowClear={allowClear} invalid={invalid} id={id}
    onCreate={(t) => quickCreateClient(t, clients)} createLabel="Créer le client" />;
}
export function SupplierPicker({ value, onChange, allowClear, invalid, id }: { value: string | null; onChange: (v: string | null) => void; allowClear?: boolean; invalid?: boolean; id?: string }) {
  const suppliers = useCollection('suppliers');
  const options = useMemo<PickOption[]>(() => suppliers.map((c) => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr')), [suppliers]);
  return <Picker value={value} onChange={onChange} options={options} placeholder="Choisir un fournisseur" allowClear={allowClear} invalid={invalid} id={id}
    onCreate={(t) => quickCreateSupplier(t, suppliers)} createLabel="Créer le fournisseur" />;
}
export function ProjectPicker({ value, onChange, id }: { value: string | null; onChange: (v: string | null) => void; id?: string }) {
  const projects = useCollection('projects');
  const options = useMemo<PickOption[]>(() => projects.filter((p) => p.status === 'active' || p.id === value).map((p) => ({ value: p.id, label: p.name })), [projects, value]);
  return <Picker value={value} onChange={onChange} options={options} placeholder="Aucun projet" allowClear emptyLabel="Aucun projet actif" id={id} />;
}

const PAYMENT_TERMS = ['', 'Comptant', 'À la livraison', '30 jours', '45 jours', '60 jours', '90 jours', '30 jours fin de mois'];

/** Client or supplier sheet. */
export function PartyDialog<K extends 'clients' | 'suppliers'>({ kind, open, onOpenChange, record, onSaved }: {
  kind: K; open: boolean; onOpenChange: (v: boolean) => void; record?: Rec<K extends 'clients' ? Client : Supplier> | null; onSaved?: (id: string) => void;
}) {
  const isClient = kind === 'clients';
  const list = useCollection(kind) as Rec<any>[];
  const [initial] = useState<any>(() => record ? { ...record } : isClient ? emptyClient() : emptySupplier());
  const [f, setF] = useState<any>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setF((x: any) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    const name = String(f.name || '').trim();
    if (!name) return setErr('Le nom est requis.');
    if (list.some((x) => x.id !== record?.id && norm(x.name) === norm(name))) return setErr(`Un ${isClient ? 'client' : 'fournisseur'} porte déjà ce nom.`);
    setBusy(true);
    try {
      const { id, _v, _updatedAt, _updatedBy, ...data } = f;
      data.name = name;
      if (record) { const { id: _i, _v: _vv, _updatedAt: _a, _updatedBy: _b, ...init } = initial; await saveChanges(kind, record as any, init, data); onSaved?.(record.id); }
      else { const nid = await createRecord(kind, data); onSaved?.(nid); }
      toast.success(record ? 'Fiche enregistrée' : `${isClient ? 'Client' : 'Fournisseur'} créé`);
      onOpenChange(false);
    } catch { /* toast shown */ } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" onSubmit={save}
      title={record ? `Fiche ${isClient ? 'client' : 'fournisseur'}` : isClient ? 'Nouveau client' : 'Nouveau fournisseur'}
      footer={<><Button onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Nom usuel" required className="sm:col-span-2" error={err}><Input value={f.name} onChange={set('name')} placeholder={isClient ? 'ex. SAFEX' : 'ex. Acier Blida'} /></Field>
        <Field label="Raison sociale" className="sm:col-span-2"><Input value={f.legalName} onChange={set('legalName')} placeholder="Nom légal complet, imprimé sur les factures" /></Field>
        <Field label="Activité"><Input value={f.activity} onChange={set('activity')} placeholder={isClient ? 'ex. Promotion immobilière' : 'ex. Acier, transport…'} /></Field>
        <Field label="Conditions de paiement">
          <Select value={f.paymentTerms} onChange={set('paymentTerms')}>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p || 'Non définies'}</option>)}</Select>
        </Field>
        <Field label="Personne de contact"><Input value={f.contactPerson} onChange={set('contactPerson')} /></Field>
        <Field label="Téléphone"><Input type="tel" value={f.phone} onChange={set('phone')} placeholder="0550 12 34 56" /></Field>
        <Field label="Second téléphone"><Input type="tel" value={f.phone2} onChange={set('phone2')} /></Field>
        <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Adresse" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
      </div>
      <p className="mt-5 mb-2 text-[13px] font-semibold">Identification fiscale</p>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-3">
        <Field label="NIF"><Input value={f.nif} onChange={set('nif')} className="num" /></Field>
        <Field label="NIS"><Input value={f.nis} onChange={set('nis')} className="num" /></Field>
        <Field label="RC"><Input value={f.rc} onChange={set('rc')} className="num" /></Field>
        {isClient && <Field label="AI"><Input value={f.ai} onChange={set('ai')} className="num" /></Field>}
        {isClient && <Field label="TIN"><Input value={f.tin} onChange={set('tin')} className="num" /></Field>}
        <Field label="RIB / RIP" className={isClient ? '' : 'sm:col-span-3'}><Input value={f.rib} onChange={set('rib')} className="num" /></Field>
      </div>
      {!isClient && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Seuil d’alerte de dette" hint="Une alerte apparaît quand la dette totale envers ce fournisseur atteint ce montant. Laissez à 0 pour désactiver.">
            <MoneyInput value={f.alertLimit || 0} onChange={(n) => setF((x: any) => ({ ...x, alertLimit: n }))} />
          </Field>
        </div>
      )}
      <Field label="Notes" className="mt-4"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
    </Dialog>
  );
}
