import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserX, UserCheck, History } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { createRecord, updateRecord, useCollection } from '@/lib/data';
import { relativeTime } from '@/lib/format';
import { DEFAULT_COMPANY } from '@/lib/print';
import type { CompanySettings, Role } from '@/lib/types';
import { Badge, Button, EmptyState, Field, Initials, Input, PageHeader, Panel, SearchInput, Select } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';

interface U { id: number; username: string; role: Role; display_name: string; active: boolean; last_login: string | null; created_at: string; must_change_password: boolean }

const ROLE_HINT: Record<Role, string> = {
  admin: 'Accès complet, gestion des comptes',
  finance: 'Journaux, situations, fournisseurs, caisse',
  hr: 'Personnel, chantiers, pointage, salaires',
  technique: 'Chantiers et pointage',
  commercial: 'Contacts clients et fournisseurs, facturation',
  secretariat: 'Scanner des documents pour la DFC, sans accès aux montants',
};

const genPassword = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, (x) => a[x % a.length]).join('');
};

export function UsersPage() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<U[] | null>(null);
  const [edit, setEdit] = useState<U | 'new' | null>(null);
  const [reset, setReset] = useState<U | null>(null);
  const load = useCallback(() => api<U[]>('/users').then(setUsers).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u: U) => {
    if (u.active && !(await confirm({ title: `Désactiver ${u.display_name} ?`, message: 'La personne ne pourra plus se connecter. Ses données et son historique sont conservés. Vous pourrez réactiver le compte à tout moment.', confirmLabel: 'Désactiver', danger: true }))) return;
    try { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); toast.success(u.active ? 'Compte désactivé' : 'Compte réactivé'); load(); } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (u: U) => {
    if (!(await confirm({ title: `Supprimer le compte ${u.username} ?`, message: 'Préférez la désactivation si la personne peut revenir. La suppression est définitive.', confirmLabel: 'Supprimer définitivement', danger: true }))) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); toast.success('Compte supprimé'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const cols: Column<U & { id: any }>[] = [
    { key: 'name', header: 'Personne', sort: (u) => u.display_name, cell: (u) => (
      <div className="flex items-center gap-2.5"><Initials name={u.display_name} /><div><div className="font-medium">{u.display_name}{u.id === me!.id && <span className="ml-1.5 text-xs text-ink-3">(vous)</span>}</div><div className="text-xs text-ink-3">{u.username}</div></div></div>
    ) },
    { key: 'role', header: 'Rôle', sort: (u) => u.role, cell: (u) => <Badge tone={u.role === 'admin' ? 'copper' : 'neutral'}>{ROLE_LABELS[u.role] || u.role}</Badge> },
    { key: 'state', header: 'État', cell: (u) => !u.active ? <Badge tone="neg">Désactivé</Badge> : u.must_change_password ? <Badge tone="warn">Mot de passe provisoire</Badge> : <Badge tone="pos">Actif</Badge> },
    { key: 'last', header: 'Dernière connexion', hideOnMobile: true, sort: (u) => u.last_login || '', cell: (u) => <span className="text-[13px] text-ink-2">{u.last_login ? relativeTime(u.last_login) : 'Jamais'}</span> },
    { key: 'a', header: '', width: '44px', align: 'right', cell: (u) => <RowMenu items={[
      { label: 'Modifier', icon: <Pencil />, onSelect: () => setEdit(u) },
      { label: 'Réinitialiser le mot de passe', icon: <KeyRound />, onSelect: () => setReset(u) },
      u.id !== me!.id && { label: u.active ? 'Désactiver' : 'Réactiver', icon: u.active ? <UserX /> : <UserCheck />, onSelect: () => toggle(u) },
      u.id !== me!.id && { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(u) },
    ]} /> },
  ];

  return (
    <>
      <PageHeader title="Utilisateurs" description="Chaque personne a son propre compte et ne voit que les modules de son rôle."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>Nouvel utilisateur</Button>} />
      <div className="panel">
        {users === null ? <p className="p-6 text-center text-ink-3">Chargement…</p> : <DataTable rows={users as any} columns={cols} initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(u) => setEdit(u)} />}
      </div>
      <Panel title="Rôles" className="mt-5">
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {(Object.keys(ROLE_HINT) as Role[]).map((r) => <div key={r} className="text-[13px]"><dt className="font-medium">{ROLE_LABELS[r]}</dt><dd className="text-ink-3">{ROLE_HINT[r]}</dd></div>)}
        </dl>
      </Panel>
      {edit && <UserDialog user={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={load} isMe={edit !== 'new' && edit.id === me!.id} />}
      {reset && <ResetDialog user={reset} onClose={() => setReset(null)} onSaved={load} />}
    </>
  );
}

function UserDialog({ user, onClose, onSaved, isMe }: { user: U | null; onClose: () => void; onSaved: () => void; isMe: boolean }) {
  const [f, setF] = useState({ name: user?.display_name || '', username: user?.username || '', role: (user?.role || 'finance') as Role, password: user ? '' : genPassword() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null); setBusy(true);
    try {
      if (user) await api(`/users/${user.id}`, { method: 'PATCH', body: { name: f.name, role: f.role } });
      else await api('/users', { body: { name: f.name, username: f.username, role: f.role, password: f.password } });
      toast.success(user ? 'Compte modifié' : 'Compte créé', !user ? { description: `Communiquez à ${f.name} : identifiant ${f.username.trim().toLowerCase()}, mot de passe ${f.password}`, duration: 15000 } : undefined);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} title={user ? `Modifier ${user.display_name}` : 'Nouvel utilisateur'}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>{user ? 'Enregistrer' : 'Créer le compte'}</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nom affiché" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Cylia, secrétariat" required /></Field>
        <Field label="Identifiant de connexion" required hint={user ? 'L’identifiant ne peut pas être modifié.' : 'Lettres minuscules, chiffres, point ou tiret.'}>
          <Input value={f.username} disabled={!!user} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="ex. cylia" required autoCapitalize="none" />
        </Field>
        <Field label="Rôle" hint={ROLE_HINT[f.role]}>
          <Select value={f.role} disabled={isMe} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{(Object.keys(ROLE_HINT) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
        </Field>
        {!user && (
          <Field label="Mot de passe provisoire" className="sm:col-span-2" hint="La personne devra le changer à sa première connexion.">
            <div className="flex gap-2"><Input className="num" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><Button onClick={() => setF({ ...f, password: genPassword() })}>Générer</Button></div>
          </Field>
        )}
        {err && <p role="alert" className="rounded-md bg-neg-soft px-3 py-2 text-[13px] text-neg sm:col-span-2">{err}</p>}
      </div>
    </Dialog>
  );
}

function ResetDialog({ user, onClose, onSaved }: { user: U; onClose: () => void; onSaved: () => void }) {
  const [pwd, setPwd] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api(`/users/${user.id}`, { method: 'PATCH', body: { password: pwd } }); toast.success('Mot de passe réinitialisé', { description: `Nouveau mot de passe provisoire de ${user.display_name} : ${pwd}`, duration: 15000 }); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="sm" title={`Réinitialiser le mot de passe de ${user.display_name}`}
      description="La personne devra choisir son propre mot de passe à la prochaine connexion."
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Réinitialiser</Button></>}>
      <Field label="Mot de passe provisoire"><div className="flex gap-2"><Input className="num" value={pwd} onChange={(e) => setPwd(e.target.value)} /><Button onClick={() => setPwd(genPassword())}>Générer</Button></div></Field>
    </Dialog>
  );
}

// ───────── Activity log ─────────
const ACTION: Record<string, string> = { create: 'a créé', update: 'a modifié', delete: 'a supprimé', login: 's’est connecté', password_change: 'a changé son mot de passe', user_create: 'a créé le compte', user_update: 'a modifié le compte', user_delete: 'a supprimé le compte', migration: 'Migration des données :' };
const COLL: Record<string, string> = { transactions: 'un mouvement', situations: 'une situation', supplierInvoices: 'une facture fournisseur', clients: 'le client', suppliers: 'le fournisseur', charges: 'la charge', projects: 'le projet', pettyCash: 'un mouvement de caisse Terkmane', simulator: 'le plan de paiement', settings: 'les informations de l’entreprise', invoices: 'une facture', workers: 'l’employé', workSites: 'le chantier', attendance: 'le pointage', hrDocuments: 'le document', pendingScans: 'un document scanné' };

export function ActivityPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { api<any[]>('/audit').then(setRows).catch((e) => toast.error(e.message)); }, []);
  const list = useMemo(() => (rows || []).filter((r) => !q || [r.username, r.label, r.collection, r.action].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()))), [rows, q]);
  return (
    <>
      <PageHeader title="Journal d’activité" description="Qui a fait quoi, et quand. Les 300 dernières actions." />
      <div className="panel">
        <div className="border-b border-line p-3"><SearchInput value={q} onChange={setQ} placeholder="Personne, élément…" /></div>
        {rows === null ? <p className="p-6 text-center text-ink-3">Chargement…</p> : list.length === 0 ? <EmptyState icon={<History className="size-5" />} title="Aucune activité" /> : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-[13.5px]">
                <Initials name={r.username || '?'} className="size-7" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{r.username}</span> {ACTION[r.action] || r.action} {r.collection ? COLL[r.collection] || r.collection : ''} {r.label && <span className="text-ink-2">« {r.label} »</span>}
                </div>
                <time className="shrink-0 text-xs text-ink-3" title={new Date(r.at).toLocaleString('fr-FR')}>{relativeTime(r.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ───────── Company settings ─────────
export function CompanyPage() {
  const recs = useCollection('settings');
  const rec = recs.find((r) => r.id === 'company');
  const [f, setF] = useState<CompanySettings>(() => ({ ...DEFAULT_COMPANY, ...(rec || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CompanySettings) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const { id, _v, _updatedAt, _updatedBy, ...data } = f as any;
      if (rec) await updateRecord('settings', rec, data); else await createRecord('settings', data, 'company');
      toast.success('Informations enregistrées', { description: 'Elles apparaîtront sur tous les documents imprimés.' });
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Entreprise" description="Informations imprimées en en-tête de chaque document : factures, décharges, relevés, rapports." />
      <form className="panel max-w-3xl p-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Raison sociale" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Activité" className="sm:col-span-2"><Input value={f.activity} onChange={set('activity')} /></Field>
          <Field label="Adresse" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
          <Field label="Ville"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Téléphone"><Input value={f.phone} onChange={set('phone')} /></Field>
          <Field label="E-mail" className="sm:col-span-2"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="RC"><Input className="num" value={f.rc} onChange={set('rc')} /></Field>
          <Field label="NIF"><Input className="num" value={f.nif} onChange={set('nif')} /></Field>
          <Field label="NIS"><Input className="num" value={f.nis} onChange={set('nis')} /></Field>
          <Field label="Article d’imposition (AI)"><Input className="num" value={f.ai} onChange={set('ai')} /></Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="size-3.5" />Visible par tous les utilisateurs, modifiable par l’administrateur.</p>
          <Button type="submit" variant="primary" loading={busy}>Enregistrer</Button>
        </div>
      </form>
    </>
  );
}

