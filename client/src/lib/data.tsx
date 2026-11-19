// Client-side data store.
// - First load pulls every collection this role may read.
// - Then it polls "what changed since rev N?" every 15 s (and when the tab
//   regains focus), so a colleague's changes appear without reloading.
// - Writes go to the server first; only confirmed records enter the store.
//   If someone else changed the same record meanwhile, the server refuses
//   (409) and the store is refreshed with their version.

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import type { CollectionName, Collections, Rec } from './types';

interface RawRecord { collection: string; id: string; data: any; version: number; rev: number; deleted: boolean; updatedAt?: string; updatedBy?: string }

type Op =
  | { op: 'create'; collection: CollectionName; id?: string; data: any }
  | { op: 'update'; collection: CollectionName; id: string; data: any; version?: number }
  | { op: 'delete'; collection: CollectionName; id: string };

class Store {
  rev = 0;
  loaded = false;
  readable = new Set<string>();
  private maps = new Map<string, Map<string, Rec<any>>>();
  private cache = new Map<string, Rec<any>[]>();
  private listeners = new Set<() => void>();
  version = 0;
  status: 'idle' | 'syncing' | 'offline' = 'idle';
  lastSync: Date | null = null;

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private emit() { this.version++; this.listeners.forEach((l) => l()); }

  list<K extends CollectionName>(c: K): Rec<Collections[K]>[] {
    let v = this.cache.get(c);
    if (!v) {
      v = [...(this.maps.get(c)?.values() ?? [])];
      this.cache.set(c, v);
    }
    return v as Rec<Collections[K]>[];
  }
  get<K extends CollectionName>(c: K, id: string | null | undefined): Rec<Collections[K]> | undefined {
    if (!id) return undefined;
    return this.maps.get(c)?.get(id) as Rec<Collections[K]> | undefined;
  }

  apply(records: RawRecord[]) {
    if (!records.length) return;
    for (const r of records) {
      let m = this.maps.get(r.collection);
      if (!m) { m = new Map(); this.maps.set(r.collection, m); }
      if (r.deleted) m.delete(r.id);
      else m.set(r.id, { ...r.data, id: r.id, _v: r.version, _updatedAt: r.updatedAt, _updatedBy: r.updatedBy });
      this.cache.delete(r.collection);
      if (r.rev > this.rev) this.rev = r.rev;
    }
    this.emit();
  }

  reset() { this.maps.clear(); this.cache.clear(); this.rev = 0; this.loaded = false; this.readable.clear(); this.emit(); }

  setStatus(s: Store['status']) { if (this.status !== s) { this.status = s; this.emit(); } }

  async sync() {
    try {
      this.setStatus('syncing');
      const res = await api<{ rev: number; records: RawRecord[]; collections: string[]; full: boolean }>(`/sync?since=${this.rev}`);
      if (res.full) { this.maps.clear(); this.cache.clear(); }
      res.collections.forEach((c) => this.readable.add(c));
      this.apply(res.records);
      if (res.rev > this.rev) this.rev = res.rev;
      this.loaded = true;
      this.lastSync = new Date();
      this.setStatus('idle');
      this.emit();
    } catch (e) {
      this.setStatus('offline');
      throw e;
    }
  }

  async mutate(ops: Op[]) {
    try {
      const res = await api<{ records: RawRecord[] }>('/records', { body: { ops } });
      this.apply(res.records);
      return res.records;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        if (e.body?.current) this.apply([e.body.current]);
        this.sync().catch(() => {});
        toast.error('Modifié par quelqu’un d’autre', { description: 'Les données viennent d’être mises à jour. Vérifiez puis recommencez.' });
      } else if (e instanceof ApiError && e.status === 404) {
        this.sync().catch(() => {});
        toast.error('Cet élément a été supprimé entre-temps.');
      } else if (e instanceof ApiError) {
        toast.error(e.message);
      }
      throw e;
    }
  }
}

export const store = new Store();

// ── Convenience writers ──
export async function createRecord<K extends CollectionName>(c: K, data: Collections[K], id?: string) {
  const [r] = await store.mutate([{ op: 'create', collection: c, data, id }]);
  return r.id;
}
export async function updateRecord<K extends CollectionName>(c: K, rec: Rec<Collections[K]>, patch: Partial<Collections[K]>) {
  const { id, _v, _updatedAt, _updatedBy, ...data } = rec as any;
  await store.mutate([{ op: 'update', collection: c, id, version: _v, data: { ...data, ...patch } }]);
}
export async function deleteRecord(c: CollectionName, id: string) {
  await store.mutate([{ op: 'delete', collection: c, id }]);
}
/**
 * Saves only the fields the person changed in a form, on top of the LATEST
 * version of the record. If a colleague changed other fields meanwhile, both
 * changes are kept instead of one silently overwriting the other.
 */
export async function saveChanges<K extends CollectionName>(c: K, rec: Rec<Collections[K]>, initial: Record<string, any>, current: Record<string, any>) {
  const patch: Record<string, any> = {};
  for (const k of Object.keys(current)) if (JSON.stringify(current[k]) !== JSON.stringify(initial[k])) patch[k] = current[k];
  if (!Object.keys(patch).length) return false;
  const latest = store.get(c, rec.id) ?? rec;
  await updateRecord(c, latest, patch as any);
  return true;
}
export const stripMeta = <T,>(rec: Rec<T>): T => { const { id, _v, _updatedAt, _updatedBy, ...d } = rec as any; return d; };

// ── React bindings ──
export function useCollection<K extends CollectionName>(c: K): Rec<Collections[K]>[] {
  return useSyncExternalStore(store.subscribe, () => store.list(c));
}
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, () => store.version);
}
export function useSyncStatus() {
  useStoreVersion();
  return { status: store.status, lastSync: store.lastSync, loaded: store.loaded };
}
/** Lookup helper: id → record, recomputed when the collection changes. */
export function useIndex<K extends CollectionName>(c: K) {
  const list = useCollection(c);
  return useMemo(() => new Map(list.map((r) => [r.id, r])), [list]);
}

const DataReady = createContext(false);
export const useDataReady = () => useContext(DataReady);

export function DataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(store.loaded);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    store.sync().then(() => alive && setReady(true)).catch((e) => alive && setError(e.message));
    const tick = () => { if (document.visibilityState === 'visible') store.sync().catch(() => {}); };
    timer.current = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);
    return () => { alive = false; clearInterval(timer.current); window.removeEventListener('focus', tick); window.removeEventListener('online', tick); };
  }, []);

  if (error && !ready) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-base font-semibold">Impossible de charger les données</p>
          <p className="mt-1 text-ink-2">{error}</p>
          <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface" onClick={() => location.reload()}>Réessayer</button>
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-3">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-line"><div className="anim-beam h-full w-full bg-copper" /></div>
          <span className="text-sm">Chargement des données…</span>
        </div>
      </div>
    );
  }
  return <DataReady.Provider value>{children}</DataReady.Provider>;
}
