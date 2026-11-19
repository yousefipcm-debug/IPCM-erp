/** Excel-friendly CSV (semicolon separator, UTF-8 BOM so accents open correctly). */
import { toast } from 'sonner';
import { IS_DEMO } from './api';
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  if (IS_DEMO) { toast.info('Export Excel indisponible dans la démo en ligne', { description: `${rows.length} ligne(s) seraient exportées dans « ${filename} ».` }); return; }
  const cell = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
