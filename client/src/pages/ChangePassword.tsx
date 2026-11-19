import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input } from '@/components/ui/ui';

export function ChangePasswordDialog({ open, onOpenChange, forced }: { open: boolean; onOpenChange: (v: boolean) => void; forced?: boolean }) {
  const { refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (next.length < 8) return setError('Le nouveau mot de passe doit faire au moins 8 caractères.');
    if (next !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      await api('/auth/password', { body: { current, next } });
      toast.success('Mot de passe modifié');
      setCurrent(''); setNext(''); setConfirm('');
      await refreshUser();
      onOpenChange(false);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!forced || !v ? onOpenChange(v) : null)} size="sm" onSubmit={submit}
      title={forced ? 'Choisissez un nouveau mot de passe' : 'Changer mon mot de passe'}
      description={forced ? 'Pour sécuriser votre compte, remplacez le mot de passe qui vous a été communiqué.' : undefined}
      footer={<>{!forced && <Button onClick={() => onOpenChange(false)}>Annuler</Button>}<Button type="submit" variant="primary" loading={busy}>Enregistrer le mot de passe</Button></>}>
      <div className="space-y-3.5">
        <Field label="Mot de passe actuel"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="Nouveau mot de passe" hint="8 caractères minimum"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <Field label="Confirmer le nouveau mot de passe"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
        {error && <p role="alert" className="rounded-md bg-neg-soft px-3 py-2 text-[13px] text-neg">{error}</p>}
      </div>
    </Dialog>
  );
}
