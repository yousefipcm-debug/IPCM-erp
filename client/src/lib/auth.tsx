import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import { store } from './data';
import type { Role, User } from './types';

interface AuthCtx {
  user: User | null;
  checking: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur', finance: 'DFC', hr: 'Ressources humaines', technique: 'Technique', commercial: 'Commercial', secretariat: 'Secrétariat',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    store.reset();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { store.reset(); setUser(null); });
    if (!tokenStore.get()) return;
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { body: { username, password } });
    tokenStore.set(r.token, remember);
    store.reset();
    setUser(r.user);
    return r.user;
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api<{ user: User }>('/auth/me');
    setUser(r.user);
  }, []);

  return <Ctx.Provider value={{ user, checking, login, logout, refreshUser }}>{children}</Ctx.Provider>;
}
