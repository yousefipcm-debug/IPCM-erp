// Official documents (invoices, décharges, reports) are rendered as a clean
// standalone page with the company letterhead, then sent to the printer.
// From the print dialog the person can also "Save as PDF".

import { store } from './data';
import type { CompanySettings } from './types';
import { dateLong } from './format';
import { toast } from 'sonner';
import { IS_DEMO } from './api';
import logoUrl from '../../../public/ipcm-logo.png';

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'I.P.C.M BOUTEMA',
  activity: "Entreprise industrielle de production d'ensembles de construction métallique",
  address: 'Rue des Frères Djennadi, 3ème étage, Lot 35 Div 96, Blida',
  rc: '09/00-4108712A23',
  nif: '16922040023019500900',
  nis: '196922040023050',
  ai: '',
  phone: '0550 70 01 96',
  email: 'direction.ipcmboutema@gmail.com',
  city: 'Blida',
};

export function company(): CompanySettings {
  const rec = store.get('settings', 'company');
  return { ...DEFAULT_COMPANY, ...(rec ? (({ id, _v, _updatedAt, _updatedBy, ...d }) => d)(rec as any) : {}) };
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function letterhead() {
  const c = company();
  const ids = [c.rc && `RC ${esc(c.rc)}`, c.nif && `NIF ${esc(c.nif)}`, c.nis && `NIS ${esc(c.nis)}`, c.ai && `AI ${esc(c.ai)}`].filter(Boolean).join('&emsp;');
  return `
  <header class="lh">
    <div class="lh-text">
      <div class="lh-name">${esc(c.name)}</div>
      <div>${esc(c.activity)}</div>
      <div>${esc(c.address)}</div>
      <div>${ids}</div>
      <div>Tél. ${esc(c.phone)}&emsp;${esc(c.email)}</div>
    </div>
    <img class="lh-logo" src="${logoUrl.startsWith('data:') ? logoUrl : location.origin + logoUrl}" alt="" />
  </header>`;
}

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'IBM Plex Sans',Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:14mm}
  @media print{body{padding:0}}
  .lh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:8px;border-bottom:2px solid #C8782A;margin-bottom:10px;font-size:8.5pt;line-height:1.55;color:#333}
  .lh-name{font-size:12pt;font-weight:700;color:#111;letter-spacing:.02em}
  .lh-logo{height:46px;object-fit:contain}
  .meta{display:flex;justify-content:space-between;font-size:9.5pt;color:#444;margin:6px 0 14px}
  h1{font-size:15pt;text-align:center;margin:10px 0 16px;font-weight:700}
  h2{font-size:11pt;margin:16px 0 6px}
  table{width:100%;border-collapse:collapse;font-size:9.5pt}
  th{background:#f1f2f4;text-align:left;font-weight:600;padding:6px 8px;border:1px solid #d5d8dc}
  td{padding:6px 8px;border:1px solid #e1e3e6;vertical-align:top}
  tr{page-break-inside:avoid}
  thead{display:table-header-group}
  .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .c{text-align:center}
  .muted{color:#666}
  .pos{color:#1d6b42}.neg{color:#a5301f}
  .box{border:1px solid #d5d8dc;padding:10px 12px;margin:10px 0}
  .sums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 14px}
  .sums div{border:1px solid #d5d8dc;padding:8px 10px}
  .sums b{display:block;font-size:12pt;margin-top:2px;font-variant-numeric:tabular-nums}
  .sig{display:flex;justify-content:space-between;gap:40px;margin-top:48px}
  .sig>div{flex:1;text-align:center;font-size:9.5pt}
  .sig .line{border-top:1px solid #444;margin-top:56px;padding-top:4px;color:#555}
  tfoot td{font-weight:700;background:#fafafa}
`;

export function printDocument(opts: { title: string; body: string; landscape?: boolean; dir?: 'rtl' | 'ltr'; extraCss?: string; letterhead?: boolean }) {
  if (IS_DEMO) {
    toast.info('Impression indisponible dans la démo en ligne', { description: `« ${opts.title} » s’ouvre en document prêt à imprimer (ou à enregistrer en PDF) dans la version installée.` });
    return;
  }
  const w = window.open('', '_blank', 'width=960,height=760');
  if (!w) { alert("Autorisez les fenêtres pop-up pour ce site afin d'imprimer."); return; }
  const fontHref = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('');
  w.document.open();
  w.document.write(`<!doctype html><html lang="${opts.dir === 'rtl' ? 'ar' : 'fr'}" dir="${opts.dir || 'ltr'}"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
    ${fontHref}
    <style>@page{size:A4 ${opts.landscape ? 'landscape' : 'portrait'};margin:10mm}${BASE_CSS}${opts.extraCss || ''}
    html,body{background:#fff!important;color:#111!important}</style></head>
    <body>${opts.letterhead === false ? '' : letterhead()}${opts.body}</body></html>`);
  w.document.close();
  const go = () => { w.focus(); w.print(); };
  const imgs = [...w.document.images];
  Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; }))))
    .then(() => (w.document as any).fonts?.ready)
    .then(() => setTimeout(go, 150));
}

export const printedOn = () => `Édité le ${dateLong(new Date())}`;
