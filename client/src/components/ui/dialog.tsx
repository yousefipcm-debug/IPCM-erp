import * as RD from '@radix-ui/react-dialog';
import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import clsx from '@/lib/cn';
import { X } from 'lucide-react';
import { Button } from './ui';

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
  footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; onSubmit?: () => void | Promise<void>;
}) {
  const width = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[540px]', lg: 'sm:max-w-[720px]', xl: 'sm:max-w-[960px]' }[size];
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  const Body: any = onSubmit ? 'form' : 'div';
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-[rgb(15_17_19/0.42)] backdrop-blur-[2px]" />
        <RD.Content
          className={clsx('anim-pop fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-pop outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl', width)}
          onOpenAutoFocus={(e) => {
            const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea');
            if (el) { e.preventDefault(); el.focus(); }
          }}>
          <Body onSubmit={onSubmit ? submit : undefined} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
              <div className="min-w-0">
                <RD.Title className="text-base font-semibold">{title}</RD.Title>
                {description ? <RD.Description className="mt-0.5 text-[13px] text-ink-3">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === 'string' ? title : ''}</RD.Description>}
              </div>
              <RD.Close asChild><Button variant="ghost" size="sm" aria-label="Fermer" icon={<X className="size-4" />} /></RD.Close>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
          </Body>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

// ───────────── Confirm (replaces window.confirm) ─────────────
interface ConfirmOpts { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | undefined>(undefined);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); resolver.current = undefined; setOpts(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(v) => !v && close(false)} title={opts?.title} size="sm"
        footer={<>
          <Button onClick={() => close(false)}>Annuler</Button>
          <Button data-autofocus variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{opts?.confirmLabel || 'Confirmer'}</Button>
        </>}>
        {opts?.message && <div className="text-[13.5px] text-ink-2">{opts.message}</div>}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}
