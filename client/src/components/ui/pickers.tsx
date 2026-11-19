import * as Popover from '@radix-ui/react-popover';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Command } from 'cmdk';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import clsx from '@/lib/cn';
import { Check, ChevronsUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { parseAmount } from '@/lib/format';
import { Button } from './ui';

// ───────────── Money input ─────────────
// Shows "1 234 567,00" when not focused; accepts spaces, dots or commas.
const fmtInput = (n: number) => (n ? new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n).replace(/ /g, ' ') : '');
export const MoneyInput = forwardRef<HTMLInputElement, { value: number; onChange: (n: number) => void; id?: string; placeholder?: string; autoFocus?: boolean; invalid?: boolean; disabled?: boolean; 'aria-describedby'?: string }>(
  function MoneyInput({ value, onChange, id, placeholder = '0', autoFocus, invalid, disabled, ...rest }, ref) {
    const [text, setText] = useState(fmtInput(value));
    const [focus, setFocus] = useState(false);
    useEffect(() => { if (!focus) setText(fmtInput(value)); }, [value, focus]);
    return (
      <div className="relative">
        <input ref={ref} id={id} aria-describedby={rest['aria-describedby']} inputMode="decimal" autoComplete="off" autoFocus={autoFocus} disabled={disabled}
          aria-invalid={invalid || undefined}
          className="control num pr-10 text-right" placeholder={placeholder} value={text}
          onFocus={(e) => { setFocus(true); requestAnimationFrame(() => e.target.select()); }}
          onBlur={() => { setFocus(false); setText(fmtInput(parseAmount(text))); }}
          onChange={(e) => { setText(e.target.value); onChange(parseAmount(e.target.value)); }} />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-3">DA</span>
      </div>
    );
  });

// ───────────── Searchable picker (clients, suppliers, projects…) ─────────────
export interface PickOption { value: string; label: string; hint?: string }
export function Picker({ value, onChange, options, placeholder = 'Choisir…', emptyLabel = 'Aucun résultat', onCreate, createLabel = 'Créer', allowClear, id, invalid }: {
  value: string | null; onChange: (v: string | null) => void; options: PickOption[]; placeholder?: string; emptyLabel?: string;
  onCreate?: (text: string) => Promise<string | null | undefined> | string | null | undefined; createLabel?: string; allowClear?: boolean; id?: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const exact = options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(''); }}>
      <Popover.Trigger asChild>
        <button id={id} type="button" aria-invalid={invalid || undefined} className={clsx('control flex items-center justify-between gap-2 text-left', !selected && 'text-ink-3')}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="anim-pop z-[60] w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          <Command loop>
            <Command.Input value={q} onValueChange={setQ} placeholder="Rechercher…" className="h-10 w-full border-b border-line bg-transparent px-3 text-sm outline-none" />
            <Command.List className="scroll-thin max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-3 text-[13px] text-ink-3">{emptyLabel}</Command.Empty>
              {allowClear && value && (
                <Command.Item value="__clear" onSelect={() => { onChange(null); setOpen(false); }} className="flex cursor-pointer items-center rounded-md px-2.5 py-2 text-[13px] text-ink-3 data-[selected=true]:bg-surface-2">Aucun</Command.Item>
              )}
              {options.map((o) => (
                <Command.Item key={o.value} value={o.label + ' ' + (o.hint || '') + ' ' + o.value} onSelect={() => { onChange(o.value); setOpen(false); }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] data-[selected=true]:bg-surface-2">
                  <Check className={clsx('size-4 shrink-0', o.value === value ? 'text-copper' : 'opacity-0')} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto truncate pl-2 text-xs text-ink-3">{o.hint}</span>}
                </Command.Item>
              ))}
              {onCreate && q.trim() && !exact && (
                <Command.Item value={'__create ' + q} onSelect={async () => { const id = await onCreate(q.trim()); if (id) onChange(id); setOpen(false); }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-copper-strong data-[selected=true]:bg-copper-soft">
                  <Plus className="size-4" /> {createLabel} « {q.trim()} »
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ───────────── Row actions menu ─────────────
export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }
export function RowMenu({ items, label = 'Actions' }: { items: (MenuItem | false | null | undefined)[]; label?: string }) {
  const list = items.filter(Boolean) as MenuItem[];
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={label} onClick={(e) => e.stopPropagation()} icon={<MoreHorizontal className="size-4" />} />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={4} onClick={(e) => e.stopPropagation()} className="anim-pop z-[60] min-w-[190px] rounded-lg border border-line bg-surface p-1 shadow-pop">
          {list.map((it, i) => (
            <DM.Item key={i} disabled={it.disabled} onSelect={it.onSelect}
              className={clsx('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2',
                it.danger && 'text-neg data-[highlighted]:bg-neg-soft')}>
              {it.icon && <span className="[&>svg]:size-4">{it.icon}</span>}
              {it.label}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function Menu({ trigger, items }: { trigger: ReactNode; items: (MenuItem | 'sep')[] }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="anim-pop z-[60] min-w-[220px] rounded-lg border border-line bg-surface p-1 shadow-pop">
          {items.map((it, i) => it === 'sep' ? <DM.Separator key={i} className="my-1 h-px bg-line" /> : (
            <DM.Item key={i} onSelect={it.onSelect} className={clsx('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] outline-none data-[highlighted]:bg-surface-2', it.danger && 'text-neg')}>
              {it.icon && <span className="[&>svg]:size-4 text-ink-3">{it.icon}</span>}{it.label}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
