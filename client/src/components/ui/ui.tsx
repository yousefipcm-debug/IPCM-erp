import { cloneElement, forwardRef, isValidElement, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from '@/lib/cn';
import { Loader2, Search, X } from 'lucide-react';

// ───────────── Button ─────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }

const variants: Record<Variant, string> = {
  primary: 'bg-copper text-white hover:bg-copper-strong shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  quiet: 'text-copper-strong hover:bg-copper-soft',
  danger: 'bg-neg text-white hover:brightness-95',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading}
      className={clsx('inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] font-medium transition-colors disabled:opacity-55',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm', !children && (size === 'sm' ? 'w-8 px-0' : 'w-9 px-0'), variants[variant], className)}
      {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ───────────── Form fields ─────────────
export function Field({ label, hint, error, children, className, htmlFor, required }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string; required?: boolean }) {
  const auto = useId();
  const msgId = auto + '-msg';
  // Link the label (and the hint/error text) to the control automatically.
  let id = htmlFor;
  let child = children;
  if (!id && isValidElement(children)) {
    const props: any = children.props;
    id = props.id || auto;
    child = cloneElement(children as any, { id, 'aria-describedby': error || hint ? msgId : undefined });
  }
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      {label && <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{label}{required && <span className="text-neg"> *</span>}</label>}
      {child}
      {error ? <p id={msgId} role="alert" className="text-xs text-neg">{error}</p> : hint ? <p id={msgId} className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx('control', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={clsx('control', className)} {...p} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('control appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237b838c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
      <input className="control pl-8" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && <button aria-label="Effacer" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink"><X className="size-4" /></button>}
    </div>
  );
}

/** Two-to-four option switch (e.g. Entrée / Sortie). */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md', id }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; tone?: 'pos' | 'neg' }[]; className?: string; size?: Size; id?: string }) {
  return (
    <div id={id} role="radiogroup" className={clsx('inline-flex rounded-[8px] bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
            className={clsx('flex-1 rounded-[6px] px-3 font-medium whitespace-nowrap transition-colors', size === 'sm' ? 'h-7 text-[13px]' : 'h-8 text-sm',
              active ? clsx('bg-surface shadow-sm', o.tone === 'pos' ? 'text-pos' : o.tone === 'neg' ? 'text-neg' : 'text-ink') : 'text-ink-3 hover:text-ink')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--copper)]" />
      {label}
    </label>
  );
}

// ───────────── Display ─────────────
type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'info' | 'copper';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  copper: 'bg-copper-soft text-copper-strong',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Panel({ title, actions, children, className, bodyClassName, description }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={clsx('panel', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

/** A figure with its label. `emphasis` is used for the one number that matters on a page. */
export function Stat({ label, value, sub, tone, className, onClick }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' | 'warn'; className?: string; onClick?: () => void }) {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={clsx('min-w-0 text-left', onClick && 'group rounded-lg transition-colors hover:bg-surface-2', className)}>
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className={clsx('num mt-0.5 truncate text-xl font-semibold tracking-tight', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg', tone === 'warn' && 'text-warn')}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-ink-3">{sub}</p>}
    </Comp>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Amount({ value, signedDisplay, className, decimals = true }: { value: number; signedDisplay?: 'in' | 'out'; className?: string; decimals?: boolean }) {
  const s = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(Math.abs(value)).replace(/ /g, ' ');
  const neg = signedDisplay ? signedDisplay === 'out' : value < 0;
  return (
    <span className={clsx('num whitespace-nowrap', signedDisplay === 'in' && 'text-pos', signedDisplay === 'out' && 'text-neg', className)}>
      {signedDisplay ? (neg ? '−' : '+') : neg ? '−' : ''}{s}<span className="ml-0.5 text-[0.85em] opacity-60">DA</span>
    </span>
  );
}

export function ProgressBar({ value, tone = 'pos', className }: { value: number; tone?: 'pos' | 'copper' | 'neg'; className?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={clsx('h-1.5 overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full', tone === 'pos' ? 'bg-pos' : tone === 'neg' ? 'bg-neg' : 'bg-copper')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2', className)}>{ini}</span>;
}
