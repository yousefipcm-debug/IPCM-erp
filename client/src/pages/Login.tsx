import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button, Checkbox, Field, Input } from '@/components/ui/ui';
import { BrandMark, BRAND } from '@/components/layout/BrandMark';
import { IS_DEMO } from '@/lib/api';

const DEMO_ACCOUNTS = [
  { u: 'finance', label: 'DFC', who: 'Hakima' },
  { u: 'admin', label: 'Administrateur', who: 'Youcef' },
  { u: 'rh', label: 'Ressources humaines', who: 'Radia' },
];

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try { await login(username.trim().toLowerCase(), password, remember); }
    catch (err: any) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-[#121417] text-white lg:block">
        {/* The brand's two linked frames, drawn large and quiet (solid tones, no transparency) */}
        <svg className="absolute -top-20 -right-20 h-[520px] w-[520px]" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="54" height="54" rx="13" stroke="#1B3B38" strokeWidth="7" />
          <rect x="38" y="38" width="54" height="54" rx="13" stroke="#3A2918" strokeWidth="7" />
          <path d="M32 62h12" stroke="#1B3B38" strokeWidth="7" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <BrandMark className="size-9" />
            <span className="text-lg font-semibold tracking-[0.2em]">{BRAND}</span>
          </div>
          <div className="max-w-md">
            <p className="text-[34px] leading-[1.15] font-semibold tracking-tight">La structure qui tient IPCM BOUTEMA : trésorerie, chantiers et équipes.</p>
            <p className="mt-4 text-[15px] text-white/55">Construction métallique, Blida</p>
          </div>
          <p className="text-xs text-white/35">Accès réservé au personnel autorisé.</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-9" />
            <span className="text-lg font-semibold tracking-[0.2em]">{BRAND}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Utilisez l’identifiant fourni par l’administrateur.</p>

          <div className="mt-7 space-y-4">
            <Field label="Identifiant" htmlFor="u">
              <Input id="u" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex. finance" />
            </Field>
            <Field label="Mot de passe" htmlFor="p">
              <div className="relative">
                <Input id="p" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </Field>
            <Checkbox checked={remember} onChange={setRemember} label={<span className="text-ink-2">Rester connecté sur cet appareil</span>} />
          </div>

          {error && <p role="alert" className="mt-4 rounded-md bg-neg-soft px-3 py-2 text-[13px] text-neg">{error}</p>}
          <Button type="submit" variant="primary" loading={busy} className="mt-6 h-10 w-full">Se connecter</Button>
          {IS_DEMO && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-4">
              <p className="text-[13px] font-medium">Démo en ligne, données fictives</p>
              <p className="mt-0.5 text-xs text-ink-3">Choisissez un compte pour entrer directement (mot de passe : demo).</p>
              <div className="mt-3 grid gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.u} type="button" disabled={busy}
                    onClick={async () => { setBusy(true); setError(null); try { await login(a.u, 'demo', true); } catch (e: any) { setError(e.message); setBusy(false); } }}
                    className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-left text-[13.5px] hover:border-copper hover:bg-copper-soft">
                    <span>{a.label}</span><span className="text-xs text-ink-3">{a.who}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
