const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 1 234 567,00 DA */
export const money = (n: number | null | undefined, opts: { decimals?: boolean; unit?: boolean } = {}) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = (opts.decimals === false ? nf0 : nf2).format(n).replace(/ /g, ' ');
  return opts.unit === false ? s : `${s} DA`;
};
/** Compact: 12,4 M DA */
export const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md DA`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M DA`;
  if (a >= 1e4) return `${(n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k DA`;
  return money(n, { decimals: false });
};

/** Accepts "1 234 567,50", "1.234.567,5", "1234567.5" */
export const parseAmount = (s: string): number => {
  if (!s) return 0;
  let t = String(s).replace(/[\s  ]/g, '').replace(/DA|DZD/gi, '');
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Dates ── (stored as ISO yyyy-mm-dd)
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const parseISO = (s?: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, d || 1);
};
export const daysSince = (s?: string | null) => {
  const d = parseISO(s);
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - d.getTime()) / 86400000);
};
export const dateShort = (s?: string | null) => {
  const d = parseISO(s);
  return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
};
export const dateLong = (s?: string | Date | null) => {
  const d = s instanceof Date ? s : parseISO(s);
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
};
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const relativeTime = (iso?: string | Date | null) => {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.round(s / 86400)} j`;
  return d.toLocaleDateString('fr-FR');
};

export const plural = (n: number, one: string, many?: string) => `${n.toLocaleString('fr-FR')} ${n > 1 || n === 0 ? many ?? one + 's' : one}`;

// ── Montant en lettres (français, règles officielles) ──
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function fr99(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    return TENS[t] + (u === 0 ? '' : u === 1 ? ' et un' : '-' + UNITS[u]);
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : 'soixante-' + UNITS[n - 60];
  const u = n - 80;
  return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITS[u];
}
function fr999(n: number, endOfNumber: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  let s = '';
  if (h > 0) s = h === 1 ? 'cent' : UNITS[h] + (r === 0 && endOfNumber ? ' cents' : ' cent');
  if (r > 0) {
    let w = fr99(r);
    if (!endOfNumber && r === 80) w = 'quatre-vingt';
    s += (s ? ' ' : '') + w;
  }
  return s;
}
export function amountInWordsFR(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  const int = Math.floor(total / 100), cents = total % 100;
  const parts: string[] = [];
  const bn = Math.floor(int / 1e9), mn = Math.floor((int % 1e9) / 1e6), th = Math.floor((int % 1e6) / 1e3), rest = int % 1000;
  if (bn) parts.push(bn === 1 ? 'un milliard' : `${fr999(bn, true)} milliards`);
  if (mn) parts.push(mn === 1 ? 'un million' : `${fr999(mn, true)} millions`);
  if (th) parts.push(th === 1 ? 'mille' : `${fr999(th, false)} mille`);
  if (rest || !parts.length) parts.push(rest ? fr999(rest, true) : 'zéro');
  let s = parts.join(' ');
  const roundMillions = (bn || mn) && !th && !rest;
  s += roundMillions ? ' de dinars algériens' : int > 1 ? ' dinars algériens' : ' dinar algérien';
  if (cents) s += ` et ${fr99(cents)} centime${cents > 1 ? 's' : ''}`;
  return capitalize(s);
}

// ── Montant en lettres (arabe) ──
const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function ar999(n: number) {
  const p: string[] = [];
  const h = Math.floor(n / 100), r = n % 100;
  if (h) p.push(AR_HUNDREDS[h]);
  if (r) {
    if (r < 10) p.push(AR_ONES[r]);
    else if (r < 20) p.push(AR_TEENS[r - 10]);
    else { const t = Math.floor(r / 10), o = r % 10; p.push(o ? `${AR_ONES[o]} و${AR_TENS[t]}` : AR_TENS[t]); }
  }
  return p.join(' و');
}
function arGroup(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${ar999(n)} ${few}`;
  return `${ar999(n)} ${many}`;
}
export function amountInWordsAR(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  const int = Math.floor(total / 100), cents = total % 100;
  const seg: string[] = [];
  const bn = Math.floor(int / 1e9), mn = Math.floor((int % 1e9) / 1e6), th = Math.floor((int % 1e6) / 1e3), rest = int % 1000;
  if (bn) seg.push(arGroup(bn, 'مليار', 'ملياران', 'مليارات', 'مليار'));
  if (mn) seg.push(arGroup(mn, 'مليون', 'مليونان', 'ملايين', 'مليون'));
  if (th) seg.push(arGroup(th, 'ألف', 'ألفان', 'آلاف', 'ألف'));
  if (rest) seg.push(ar999(rest));
  let s = (seg.join(' و') || 'صفر') + ' دينار جزائري';
  if (cents) s += ` و${ar999(cents)} سنتيم`;
  return s;
}
