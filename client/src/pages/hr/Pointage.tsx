// Monthly attendance sheet. One record per worker per month ("YYYY-MM:<workerId>"),
// so two people can fill different rows at the same time without overwriting each other.
// Top row of each worker: code (P present, D half day, A absent, C leave, M sick…).
// Bottom row: overtime hours.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from '@/lib/cn';
import { ChevronLeft, ChevronRight, Eraser, Paintbrush, Plus, Printer, Trash2, Check } from 'lucide-react';
import { createRecord, deleteRecord, store, stripMeta, useCollection } from '@/lib/data';
import { CODES, daysInMonth, fullName, isRestDay, monthKey, shiftMonth, summarize, useHr, type Attendance, type LegendItem } from '@/lib/hr';
import { capitalize, monthLabel } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { Rec } from '@/lib/types';
import { Button, PageHeader, Select, Input } from '@/components/ui/ui';
import { ApiError } from '@/lib/api';

const DOW = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const PALETTE = ['#FCA5A5', '#FCD34D', '#86EFAC', '#93C5FD', '#C4B5FD', '#F9A8D4', '#FDBA74', '#E5E7EB'];
const codeClass = (v: string) => {
  const c = v.trim().toUpperCase();
  if (c === 'P') return 'text-pos font-semibold';
  if (c === 'D') return 'text-warn font-semibold';
  if (c === 'A') return 'text-neg font-semibold';
  if (c) return 'text-info font-semibold';
  return '';
};

/** Buffers cell edits and saves them per worker, merged onto the latest version. */
function useAttendanceWriter() {
  const pending = useRef(new Map<string, { month: string; workerId: string; cells: Record<string, { val: string; bg: string }> }>());
  const timer = useRef<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const flush = useCallback(async () => {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    setSaving(true);
    for (const [id, p] of batch) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const latest = store.get('attendance', id) as unknown as Rec<Attendance> | undefined;
        try {
          if (latest) await store.mutate([{ op: 'update', collection: 'attendance', id, version: latest._v, data: { ...stripMeta(latest), cells: { ...latest.cells, ...p.cells } } }]);
          else await createRecord('attendance', { month: p.month, workerId: p.workerId, cells: p.cells } as any, id);
          break;
        } catch (e) { if (!(e instanceof ApiError && e.status === 409) || attempt) break; }
      }
    }
    setSaving(false);
  }, []);
  const write = useCallback((month: string, workerId: string, key: string, cell: { val: string; bg: string }) => {
    const id = `${month}:${workerId}`;
    const p = pending.current.get(id) || { month, workerId, cells: {} };
    p.cells[key] = cell;
    pending.current.set(id, p);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  }, [flush]);
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, [flush]);
  return { write, saving, pendingFor: (id: string) => pending.current.get(id) };
}

export function PointagePage() {
  const hr = useHr();
  const legend = useCollection('attendanceLegend') as unknown as Rec<LegendItem>[];
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(monthKey());
  const scope = params.get('site') || 'office';
  const setScope = (v: string) => { params.set('site', v); setParams(params, { replace: true }); };
  const [paint, setPaint] = useState<string | null | 'erase'>(null);
  const { write, saving } = useAttendanceWriter();
  const [local, setLocal] = useState<Record<string, { val: string; bg: string }>>({});
  useEffect(() => setLocal({}), [month]);

  const site = scope !== 'office' && scope !== 'all' ? hr.sites.find((s) => s.id === scope) : null;
  const workers = useMemo(() => {
    if (scope === 'all') return hr.active;
    if (scope === 'office') return hr.active.filter((w) => !hr.siteOf.has(w.id));
    return (site?.workerIds || []).map((id) => hr.workers.find((w) => w.id === id)).filter(Boolean) as typeof hr.active;
  }, [hr, scope, site]);

  const n = daysInMonth(month);
  const [Y, M] = month.split('-').map(Number);
  const today = new Date();
  const todayDay = monthKey(today) === month ? today.getDate() : null;
  const dates = Array.from({ length: n }, (_, i) => new Date(Y, M - 1, i + 1));
  const onSiteOf = (wid: string) => hr.siteOf.has(wid);

  const cell = (wid: string, d: number, r: 0 | 1) => {
    const k = `${month}:${wid}|${d}_${r}`;
    return local[k] ?? hr.attOf(month, wid)?.cells[`${d}_${r}`] ?? { val: '', bg: '' };
  };
  const setCell = (wid: string, d: number, r: 0 | 1, next: { val: string; bg: string }) => {
    setLocal((l) => ({ ...l, [`${month}:${wid}|${d}_${r}`]: next }));
    write(month, wid, `${d}_${r}`, next);
  };

  // keyboard navigation between cells
  const grid = useRef<HTMLTableElement>(null);
  const move = (e: KeyboardEvent<HTMLInputElement>) => {
    const t = e.currentTarget; const r = +t.dataset.r!, c = +t.dataset.c!;
    const go = (rr: number, cc: number) => { const el = grid.current?.querySelector<HTMLInputElement>(`input[data-r="${rr}"][data-c="${cc}"]`); if (el) { e.preventDefault(); el.focus(); el.select(); } };
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.shiftKey)) go(r, c + 1);
    else if (e.key === 'ArrowLeft') go(r, c - 1);
    else if (e.key === 'ArrowDown') go(r + 1, c);
    else if (e.key === 'ArrowUp') go(r - 1, c);
  };

  const fillDay = (d: number) => {
    let k = 0;
    for (const w of workers) { if (isRestDay(dates[d - 1], onSiteOf(w.id))) continue; const c = cell(w.id, d, 0); if (!c.val) { setCell(w.id, d, 0, { ...c, val: 'P' }); k++; } }
    toast.success(k ? `${k} employé(s) marqué(s) présents le ${d}` : 'Tout le monde est déjà renseigné ce jour-là');
  };
  const fillRow = (wid: string) => {
    const last = todayDay ?? n;
    let k = 0;
    for (let d = 1; d <= last; d++) { if (isRestDay(dates[d - 1], onSiteOf(wid))) continue; const c = cell(wid, d, 0); if (!c.val) { setCell(wid, d, 0, { ...c, val: 'P' }); k++; } }
    toast.success(k ? `${k} jour(s) marqués présents` : 'Tous les jours ouvrés sont déjà renseignés');
  };
  const onCellClick = (wid: string, d: number, r: 0 | 1) => {
    if (paint === null) return;
    const c = cell(wid, d, r);
    setCell(wid, d, r, { ...c, bg: paint === 'erase' ? '' : paint });
  };

  const totals = workers.map((w) => {
    const days = { cells: {} as Record<string, any> };
    for (let d = 1; d <= n; d++) for (const r of [0, 1] as const) days.cells[`${d}_${r}`] = cell(w.id, d, r);
    return summarize(days as any, month);
  });
  const today0 = todayDay ? workers.map((w) => cell(w.id, todayDay, 0).val.trim().toUpperCase()) : [];
  const scopeName = scope === 'all' ? 'Tout le personnel' : scope === 'office' ? 'Administration' : site?.name || 'Chantier';

  const print = () => printDocument({ title: `Pointage ${monthLabel(month)}`, landscape: true, extraCss: 'table{font-size:7.5pt}td,th{padding:2px 3px}.w{background:#fff7e6}.n{white-space:nowrap}', body: `
    <div class="meta"><span>${printedOn()}</span><span>${esc(scopeName)}, ${workers.length} employé(s)</span></div>
    <h1>Feuille de présence, ${capitalize(monthLabel(month))}</h1>
    <table><thead><tr><th>N°</th><th>Nom et prénom</th>${dates.map((dt, i) => `<th class="c ${isRestDay(dt, scope !== 'office') ? 'w' : ''}">${DOW[dt.getDay()]}<br>${i + 1}</th>`).join('')}<th class="c">Jours</th><th class="c">HS</th><th class="c">Total</th></tr></thead><tbody>
    ${workers.map((w, i) => `<tr><td class="c" rowspan="2">${i + 1}</td><td class="n" rowspan="2"><b>${esc(fullName(w))}</b><br><span class="muted">${esc(w.position)}</span></td>${dates.map((dt, j) => { const c = cell(w.id, j + 1, 0); return `<td class="c ${isRestDay(dt, onSiteOf(w.id)) ? 'w' : ''}" style="${c.bg ? `background:${c.bg}` : ''}">${esc(c.val)}</td>`; }).join('')}<td class="c" rowspan="2"><b>${totals[i].days}</b></td><td class="c" rowspan="2">${totals[i].extra || ''}</td><td class="c" rowspan="2"><b>${totals[i].total || ''}</b></td></tr>
      <tr>${dates.map((dt, j) => { const c = cell(w.id, j + 1, 1); return `<td class="c muted ${isRestDay(dt, onSiteOf(w.id)) ? 'w' : ''}" style="${c.bg ? `background:${c.bg}` : ''}">${esc(c.val)}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table>
    <p class="muted" style="margin-top:8px">${CODES.map((c) => `${c.code} : ${c.label}`).join('&emsp;')}&emsp;Ligne du bas : heures supplémentaires${legend.length ? '&emsp;' + legend.map((l) => `<span style="background:${l.color};padding:0 6px">${esc(l.label)}</span>`).join(' ') : ''}</p>
    <div class="sig"><div><div class="line">Chef de chantier</div></div><div><div class="line">Ressources humaines</div></div><div><div class="line">Direction</div></div></div>` });

  return (
    <>
      <PageHeader title="Pointage" description="Saisissez un code par jour (P, D, A, C, M…) et les heures supplémentaires en dessous. Les flèches du clavier passent d’une case à l’autre."
        actions={<Button icon={<Printer className="size-4" />} onClick={print} disabled={!workers.length}>Imprimer la feuille</Button>} />

      <div className="panel mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Mois précédent" icon={<ChevronLeft className="size-4" />} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="w-36 text-center text-[14px] font-semibold">{capitalize(monthLabel(month))}</span>
          <Button size="sm" variant="ghost" aria-label="Mois suivant" icon={<ChevronRight className="size-4" />} onClick={() => setMonth(shiftMonth(month, 1))} />
          {month !== monthKey() && <Button size="sm" variant="quiet" onClick={() => setMonth(monthKey())}>Ce mois-ci</Button>}
        </div>
        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="h-8 w-auto min-w-[200px]" aria-label="Équipe">
          <option value="office">Administration</option>
          {hr.sites.filter((s) => s.status !== 'done').map((s) => <option key={s.id} value={s.id}>Chantier : {s.name}</option>)}
          <option value="all">Tout le personnel</option>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-3">{saving ? 'Enregistrement…' : 'Enregistré automatiquement'}</span>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button size="sm" variant={paint === null ? 'secondary' : 'ghost'} onClick={() => setPaint(null)}>Saisie</Button>
          {PALETTE.map((c) => <button key={c} aria-label={`Colorier en ${c}`} onClick={() => setPaint(c)} className={clsx('size-6 rounded-md border', paint === c ? 'border-ink ring-2 ring-copper' : 'border-line-strong')} style={{ background: c }} />)}
          <Button size="sm" variant={paint === 'erase' ? 'secondary' : 'ghost'} icon={<Eraser className="size-3.5" />} onClick={() => setPaint('erase')}>Effacer couleur</Button>
        </div>
      </div>
      {paint !== null && <p className="mb-2 flex items-center gap-1.5 text-[13px] text-copper-strong"><Paintbrush className="size-4" />Mode coloriage : cliquez sur les cases. Revenez en « Saisie » pour taper des codes.</p>}

      {todayDay && workers.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <span><b className="num text-pos">{today0.filter((v) => v === 'P').length + today0.filter((v) => v === 'D').length * 0.5}</b> <span className="text-ink-3">présent(s) aujourd’hui</span></span>
          <span><b className="num text-neg">{today0.filter((v) => v && v !== 'P' && v !== 'D').length}</b> <span className="text-ink-3">absent(s) ou en congé</span></span>
          <span><b className="num">{today0.filter((v) => !v).length}</b> <span className="text-ink-3">non renseigné(s)</span></span>
        </div>
      )}

      {workers.length === 0 ? (
        <div className="panel p-10 text-center text-[13.5px] text-ink-3">{scope === 'office' ? 'Aucun employé à l’administration.' : 'Aucun employé affecté à ce chantier. Affectez-en depuis la page Chantiers.'}</div>
      ) : (
        <div className="panel scroll-thin overflow-x-auto">
          <table ref={grid} className="border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 z-10 min-w-[130px] sm:min-w-[190px] bg-surface px-3 py-1.5 text-left font-medium text-ink-3">Employé</th>
                {dates.map((dt, i) => {
                  const rest = isRestDay(dt, scope !== 'office');
                  return (
                    <th key={i} className={clsx('w-[34px] min-w-[34px] px-0 py-1 text-center font-medium', rest ? 'bg-warn-soft/60 text-warn' : 'text-ink-3', todayDay === i + 1 && 'bg-copper-soft text-copper-strong')}>
                      <button className="w-full leading-tight hover:text-ink" title={`Marquer présents tous les employés non renseignés le ${i + 1}`} onClick={() => fillDay(i + 1)}>
                        <span className="block text-[10.5px]">{DOW[dt.getDay()]}</span><span className="num block">{i + 1}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="min-w-[52px] px-2 text-right font-medium text-ink-3">Jours</th>
                <th className="min-w-[44px] px-2 text-right font-medium text-ink-3">HS</th>
                <th className="sticky right-0 z-10 min-w-[56px] border-l border-line bg-surface px-3 text-right font-medium text-ink-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, wi) => (
                [0, 1].map((r) => (
                  <tr key={w.id + r} className={clsx(r === 1 && 'border-b border-line')}>
                    {r === 0 && (
                      <td rowSpan={2} className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0"><div className="truncate font-medium">{fullName(w)}</div><div className="truncate text-[11.5px] text-ink-3">{w.position}</div></div>
                          <button title="Marquer présent tous les jours ouvrés non renseignés" aria-label={`Remplir le mois de ${fullName(w)}`} onClick={() => fillRow(w.id)} className="rounded p-1 text-ink-3 hover:bg-pos-soft hover:text-pos"><Check className="size-3.5" /></button>
                        </div>
                      </td>
                    )}
                    {dates.map((dt, i) => {
                      const c = cell(w.id, i + 1, r as 0 | 1);
                      const rest = isRestDay(dt, onSiteOf(w.id));
                      return (
                        <td key={i} onClick={() => onCellClick(w.id, i + 1, r as 0 | 1)}
                          className={clsx('h-[26px] border-l border-line/60 p-0', !c.bg && rest && 'bg-warn-soft/40', !c.bg && todayDay === i + 1 && 'bg-copper-soft/50', paint !== null && 'cursor-crosshair')}
                          style={c.bg ? { background: c.bg } : undefined}>
                          <input data-r={wi * 2 + r} data-c={i} value={c.val} maxLength={r === 0 ? 3 : 4} inputMode={r === 1 ? 'decimal' : 'text'}
                            readOnly={paint !== null} aria-label={`${fullName(w)}, ${i + 1} ${r === 0 ? 'présence' : 'heures sup.'}`}
                            onKeyDown={move} onFocus={(e) => e.target.select()}
                            onChange={(e) => setCell(w.id, i + 1, r as 0 | 1, { ...c, val: r === 0 ? e.target.value.toUpperCase() : e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') })}
                            className={clsx('num h-full w-full bg-transparent text-center outline-none focus:bg-surface focus:ring-2 focus:ring-copper focus:ring-inset', r === 1 ? 'text-[11px] text-copper-strong' : codeClass(c.val), c.bg && 'text-[#111]', paint !== null && 'pointer-events-none')} />
                        </td>
                      );
                    })}
                    {r === 0 && <>
                      <td rowSpan={2} className="num border-l border-line-strong px-2 text-right font-semibold">{totals[wi].days}</td>
                      <td rowSpan={2} className="num px-2 text-right text-copper-strong">{totals[wi].extra || '—'}</td>
                      <td rowSpan={2} className="num sticky right-0 z-10 border-l border-line bg-surface px-3 text-right font-semibold">{totals[wi].total || '—'}</td>
                    </>}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-3">
        {CODES.map((c) => <span key={c.code}><b className={codeClass(c.code)}>{c.code}</b> {c.label}</span>)}
        <span>Ligne du bas : heures supplémentaires (8 h = 1 jour dans le total)</span>
        <span>Cases ocre : jours de repos</span>
      </div>
      <LegendEditor legend={legend} />
    </>
  );
}

function LegendEditor({ legend }: { legend: Rec<LegendItem>[] }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const add = async () => { if (!label.trim()) return; await createRecord('attendanceLegend', { label: label.trim(), color } as any); setLabel(''); };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-medium">Légende des couleurs</span>
      {legend.map((l) => (
        <span key={l.id} className="inline-flex items-center gap-1.5 rounded-md py-0.5 pr-1 pl-2 text-[12.5px] text-[#111]" style={{ background: l.color }}>
          {l.label}<button aria-label={`Supprimer ${l.label}`} onClick={() => deleteRecord('attendanceLegend', l.id)} className="rounded p-0.5 hover:bg-black/10"><Trash2 className="size-3" /></button>
        </span>
      ))}
      <div className="flex items-center gap-1.5">
        <select aria-label="Couleur" value={color} onChange={(e) => setColor(e.target.value)} className="control h-8 w-16" style={{ background: color }}>{PALETTE.map((c) => <option key={c} value={c} style={{ background: c }}>{' '}</option>)}</select>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Mission" className="h-8 w-36" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={add} disabled={!label.trim()}>Ajouter</Button>
      </div>
    </div>
  );
}
