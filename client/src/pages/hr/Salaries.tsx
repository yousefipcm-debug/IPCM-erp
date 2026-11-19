// Monthly pay sheet derived from pointage: net ÷ divisor × days worked.
// Office staff: ÷22 (Friday and Saturday off). Site staff: ÷26 (Friday off).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileDown, Printer } from 'lucide-react';
import { DIVISOR, fullName, monthKey, shiftMonth, summarize, useHr, type Worker } from '@/lib/hr';
import { capitalize, money, monthLabel } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import { downloadCsv } from '@/lib/csv';
import type { Rec } from '@/lib/types';
import { Button, PageHeader, Panel, Stat, Checkbox } from '@/components/ui/ui';

interface Line { w: Rec<Worker>; days: number; extra: number; total: number; filled: number; pay: number }
interface Section { id: string; name: string; divisor: number; lines: Line[]; sum: number }

export function SalariesPage() {
  const hr = useHr();
  const [month, setMonth] = useState(monthKey());
  const [withExtra, setWithExtra] = useState(true);

  const sections = useMemo<Section[]>(() => {
    const build = (id: string, name: string, divisor: number, ws: Rec<Worker>[]): Section => {
      const lines = ws.map((w) => {
        const s = summarize(hr.attOf(month, w.id), month);
        const units = withExtra ? s.total : s.days;
        return { w, ...s, pay: Math.round(((w.netSalary || 0) / divisor) * units) };
      });
      return { id, name, divisor, lines, sum: lines.reduce((a, l) => a + l.pay, 0) };
    };
    const out = [build('office', 'Administration', DIVISOR.office, hr.active.filter((w) => !hr.siteOf.has(w.id)))];
    for (const s of hr.sites.filter((s) => s.status !== 'done')) {
      const ws = s.workerIds.map((id) => hr.active.find((w) => w.id === id)).filter(Boolean) as Rec<Worker>[];
      if (ws.length) out.push(build(s.id, s.name, DIVISOR.site, ws));
    }
    return out;
  }, [hr, month, withExtra]);

  const grand = sections.reduce((a, s) => a + s.sum, 0);
  const people = sections.reduce((a, s) => a + s.lines.length, 0);
  const noPointage = sections.flatMap((s) => s.lines).filter((l) => !l.filled).length;
  const fullCost = sections.flatMap((s) => s.lines).reduce((a, l) => a + (l.w.netSalary || 0), 0);
  const label = capitalize(monthLabel(month));

  const print = () => printDocument({ title: `Salaires ${label}`, body: `
    <div class="meta"><span>${printedOn()}</span><span>${people} employé(s)</span></div>
    <h1>État des salaires, ${esc(label)}</h1>
    ${sections.map((s) => `<h2>${esc(s.name)} (÷${s.divisor})</h2>
      <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Fonction</th><th class="r">Salaire net</th><th class="r">Jours</th><th class="r">HS (h)</th><th class="r">À payer</th><th style="width:22%">Émargement</th></tr></thead><tbody>
      ${s.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(fullName(l.w))}</td><td>${esc(l.w.position)}</td><td class="r">${money(l.w.netSalary)}</td><td class="r">${l.days}</td><td class="r">${l.extra || ''}</td><td class="r"><b>${money(l.pay)}</b></td><td></td></tr>`).join('')}
      <tr class="total"><td colspan="6">Total ${esc(s.name)}</td><td class="r">${money(s.sum)}</td><td></td></tr></tbody></table>`).join('')}
    <table style="margin-top:12px"><tr class="total"><td>Total général à payer</td><td class="r" style="font-size:12pt">${money(grand)}</td></tr></table>
    <div class="sig"><div><div class="line">Ressources humaines</div></div><div><div class="line">Finance</div></div><div><div class="line">Direction</div></div></div>` });

  const exportCsv = () => downloadCsv(`salaires-${month}.csv`, ['Section', 'Nom', 'Prénom', 'Fonction', 'Salaire net', 'Diviseur', 'Jours', 'Heures sup.', 'À payer'],
    sections.flatMap((s) => s.lines.map((l) => [s.name, l.w.lastName, l.w.firstName, l.w.position, l.w.netSalary, s.divisor, l.days, l.extra, l.pay])));

  return (
    <>
      <PageHeader title="Salaires" description="Calculés à partir du pointage : salaire net ÷ jours de référence × jours travaillés. 22 jours au bureau, 26 sur chantier."
        actions={<>
          <Button icon={<FileDown className="size-4" />} onClick={exportCsv}>Excel</Button>
          <Button variant="primary" icon={<Printer className="size-4" />} onClick={print}>Imprimer l’état</Button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="panel flex items-center gap-1 p-1">
          <Button size="sm" variant="ghost" aria-label="Mois précédent" icon={<ChevronLeft className="size-4" />} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="w-36 text-center text-[14px] font-semibold">{label}</span>
          <Button size="sm" variant="ghost" aria-label="Mois suivant" icon={<ChevronRight className="size-4" />} onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <Checkbox checked={withExtra} onChange={setWithExtra} label="Inclure les heures supplémentaires (8 h = 1 jour)" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total à payer" value={money(grand)} sub={label} />
        <Stat label="Masse salariale pleine" value={money(fullCost)} sub="si tout le monde avait travaillé le mois complet" />
        <Stat label="Employés" value={people} sub={`${sections.length} section(s)`} />
        <Stat label="Sans pointage" value={noPointage} tone={noPointage ? 'neg' : undefined} sub={noPointage ? <Link to="/rh/pointage" className="text-copper-strong">Compléter le pointage</Link> : 'Tout est renseigné'} />
      </div>
      <div className="space-y-4">
        {sections.map((s) => (
          <Panel key={s.id} title={s.name} description={`${s.lines.length} employé(s), base ÷${s.divisor}`} actions={<span className="num text-[15px] font-semibold">{money(s.sum)}</span>} bodyClassName="p-0">
            {s.lines.length === 0 ? <p className="p-4 text-[13px] text-ink-3">Aucun employé.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead><tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                    <th className="px-4 py-2 font-medium">Employé</th><th className="px-3 py-2 text-right font-medium">Salaire net</th>
                    <th className="px-3 py-2 text-right font-medium">Jours</th><th className="px-3 py-2 text-right font-medium">HS (h)</th><th className="px-4 py-2 text-right font-medium">À payer</th>
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {s.lines.map((l) => (
                      <tr key={l.w.id} className="hover:bg-sunken/50">
                        <td className="px-4 py-2"><Link to={`/rh/personnel/${l.w.id}`} className="font-medium hover:text-copper-strong">{fullName(l.w)}</Link><div className="text-[12px] text-ink-3">{l.w.position}</div></td>
                        <td className="num px-3 py-2 text-right text-ink-2">{l.w.netSalary ? money(l.w.netSalary) : <span className="text-warn">Non renseigné</span>}</td>
                        <td className="num px-3 py-2 text-right">{l.filled ? l.days : <span className="text-ink-3">—</span>}</td>
                        <td className="num px-3 py-2 text-right text-copper-strong">{l.extra || ''}</td>
                        <td className="num px-4 py-2 text-right font-semibold">{money(l.pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}
