const TOKEN_KEY = 'arcis-token';
export const IS_DEMO = !!import.meta.env.VITE_DEMO;
const safe = <T,>(f: () => T, fb: T) => { try { return f(); } catch { return fb; } };

export const tokenStore = {
  mem: null as string | null,
  get: () => safe(() => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY), null) || tokenStore.mem,
  set: (t: string, remember: boolean) => {
    tokenStore.mem = t;
    safe(() => { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY); }, undefined);
  },
  clear: () => { tokenStore.mem = null; safe(() => { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); }, undefined); },
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) { super(message); }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = tokenStore.get();
  if (IS_DEMO) {
    const { handle } = await import('../demo/fakeServer');
    const r = await handle(path, opts.method || (opts.body ? 'POST' : 'GET'), opts.body ? JSON.parse(JSON.stringify(opts.body)) : null, token);
    if (r.status === 401 && path !== '/auth/login') { tokenStore.clear(); onUnauthorized?.(); }
    if (r.status >= 400) throw new ApiError(r.body?.error || `Erreur ${r.status}`, r.status, r.body);
    return r.body as T;
  }
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('Connexion au serveur impossible. Vérifiez votre réseau.', 0, null);
  }
  let body: any = null;
  try { body = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && path !== '/auth/login') {
    tokenStore.clear();
    onUnauthorized?.();
  }
  if (!res.ok) throw new ApiError(body?.error || `Erreur ${res.status}`, res.status, body);
  return body as T;
}
