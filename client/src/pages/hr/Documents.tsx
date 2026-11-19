// Shared documents (attestations, notes, ordres de mission…) organised in folders.
// A new document in a folder gets the next number automatically: "<Folder> n°007/2026".
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, FilePlus2, Folder, FolderPlus, ImagePlus, Pencil, Printer, Trash2, X } from 'lucide-react';
import { createRecord, deleteRecord, saveChanges, useCollection } from '@/lib/data';
import type { HrDocument } from '@/lib/hr';
import { dateLong, dateShort, todayISO } from '@/lib/format';
import { printDocument, esc } from '@/lib/print';
import { fileToCompressedDataUrl } from '@/lib/image';
import type { Rec } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button, EmptyState, Field, Input, PageHeader, SearchInput, Select, Textarea } from '@/components/ui/ui';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';

type Doc = Rec<HrDocument>;
const isHtml = (s: string) => /<\/?(p|div|br|b|strong|i|u|span|table|ul|ol|li|h\d)\b/i.test(s);
const sanitize = (s: string) => s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/javascript:/gi, '');
const toText = (s: string) => isHtml(s) ? (new DOMParser().parseFromString(sanitize(s), 'text/html').body.textContent || '') : s;
const bodyHtml = (s: string) => isHtml(s) ? sanitize(s) : esc(s).replace(/\n/g, '<br>');

function nextTitle(docs: Doc[], folder: string) {
  const year = new Date().getFullYear();
  const re = /n°\s*(\d+)/i;
  const max = docs.filter((d) => d.folder === folder && (d.date || '').startsWith(String(year)))
    .reduce((m, d) => Math.max(m, parseInt(re.exec(d.title)?.[1] || '0', 10)), 0);
  return `${folder} n°${String(max + 1).padStart(3, '0')}/${year}`;
}

export function printHrDocument(d: HrDocument) {
  printDocument({ title: d.title, extraCss: '.doc{font-size:11.5pt;line-height:1.6;margin-top:14px}.doc img{max-width:100%}.imgs img{max-width:48%;margin:6px 1% 0 0;border:1px solid #ddd}', body: `
    <div class="meta"><span></span><span>Blida, le ${esc(dateLong(d.date))}</span></div>
    <h1 style="text-align:center;margin-top:18px">${esc(d.title)}</h1>
    <div class="doc">${bodyHtml(d.content || '')}</div>
    ${d.images?.length ? `<div class="imgs">${d.images.map((src) => `<img src="${esc(src)}">`).join('')}</div>` : ''}
    <div class="sig"><div><div class="line">${esc(d.signerLeft || '')}</div></div><div></div><div><div class="line">${esc(d.signerRight || 'La Direction')}</div></div></div>` });
}

export function DocumentsPage() {
  const docs = useCollection('hrDocuments') as unknown as Doc[];
  const folders = useCollection('hrFolders') as unknown as Rec<{ name: string }>[];
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const folder = params.get('dossier') || '';
  const setFolder = (f: string) => { f ? params.set('dossier', f) : params.delete('dossier'); setParams(params, { replace: true }); };
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Doc | 'new' | HrDocument | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);

  const folderNames = useMemo(() => {
    const s = new Set(folders.map((f) => f.name).filter(Boolean));
    for (const d of docs) if (d.folder) s.add(d.folder);
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [folders, docs]);
  const count = (f: string) => docs.filter((d) => d.folder === f).length;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.filter((d) => (!folder || d.folder === folder) && (!s || `${d.title} ${toText(d.content || '')} ${d.signerLeft} ${d.signerRight}`.toLowerCase().includes(s)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.title.localeCompare(a.title));
  }, [docs, folder, q]);

  const addFolder = async () => {
    const name = (newFolder || '').trim();
    if (!name) return;
    if (folderNames.some((f) => f.toLowerCase() === name.toLowerCase())) { toast.error('Ce dossier existe déjà'); return; }
    await createRecord('hrFolders', { name } as any); setNewFolder(null); setFolder(name); toast.success('Dossier créé');
  };
  const removeFolder = async (name: string) => {
    if (count(name)) { toast.error('Ce dossier contient des documents', { description: 'Déplacez ou supprimez-les d’abord.' }); return; }
    if (!(await confirm({ title: `Supprimer le dossier ${name} ?`, danger: true, confirmLabel: 'Supprimer' }))) return;
    for (const f of folders.filter((f) => f.name === name)) await deleteRecord('hrFolders', f.id);
    if (folder === name) setFolder('');
  };
  const remove = async (d: Doc) => {
    if (!(await confirm({ title: `Supprimer « ${d.title} » ?`, danger: true, confirmLabel: 'Supprimer' }))) return;
    await deleteRecord('hrDocuments', d.id); toast.success('Document supprimé');
  };
  const duplicate = (d: Doc) => setEdit({ ...d, title: d.folder ? nextTitle(docs, d.folder) : `${d.title} (copie)`, date: todayISO(), id: undefined } as any);

  return (
    <>
      <PageHeader title="Documents" description="Attestations, notes de service, ordres de mission… partagés par toute l’équipe. La numérotation suit chaque dossier."
        actions={<Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => setEdit('new')}>Nouveau document</Button>} />
      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        <aside className="panel h-fit p-2">
          <FolderBtn active={!folder} onClick={() => setFolder('')} label="Tous les documents" n={docs.length} />
          {folderNames.map((f) => (
            <div key={f} className="group flex items-center">
              <FolderBtn active={folder === f} onClick={() => setFolder(f)} label={f} n={count(f)} />
              <button aria-label={`Supprimer le dossier ${f}`} onClick={() => removeFolder(f)} className="ml-0.5 hidden rounded p-1 text-ink-3 group-hover:block hover:text-neg"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
          {newFolder === null ? (
            <button onClick={() => setNewFolder('')} className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-copper-strong hover:bg-sunken"><FolderPlus className="size-4" />Nouveau dossier</button>
          ) : (
            <div className="mt-1 flex gap-1 p-1">
              <Input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="ex. Attestations" className="h-8" aria-label="Nom du dossier"
                onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setNewFolder(null); }} />
              <Button size="sm" onClick={addFolder}>OK</Button>
            </div>
          )}
        </aside>
        <section>
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher dans les titres et le contenu…" className="mb-3" />
          {list.length === 0 ? (
            <EmptyState icon={<Folder className="size-5" />} title={q ? 'Aucun document ne correspond' : 'Aucun document dans ce dossier'}
              action={!q && <Button icon={<FilePlus2 className="size-4" />} onClick={() => setEdit('new')}>Rédiger un document</Button>} />
          ) : (
            <div className="panel divide-y divide-line">
              {list.map((d) => (
                <div key={d.id} className="flex items-start gap-3 px-4 py-3 hover:bg-sunken/40">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(d)}>
                    <div className="truncate font-medium">{d.title || 'Sans titre'}</div>
                    <div className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{toText(d.content || '').slice(0, 180) || 'Document vide'}</div>
                    <div className="mt-1 flex gap-3 text-[12px] text-ink-3">
                      <span className="num">{dateShort(d.date)}</span>{d.folder && <span>{d.folder}</span>}{d.images?.length ? <span>{d.images.length} image(s)</span> : null}
                    </div>
                  </button>
                  <Button size="sm" variant="ghost" aria-label="Imprimer" icon={<Printer className="size-4" />} onClick={() => printHrDocument(d)} />
                  <RowMenu items={[
                    { label: 'Modifier', icon: <Pencil className="size-4" />, onSelect: () => setEdit(d) },
                    { label: 'Dupliquer', icon: <Copy className="size-4" />, onSelect: () => duplicate(d) },
                    { label: 'Supprimer', icon: <Trash2 className="size-4" />, danger: true, onSelect: () => remove(d) },
                  ]} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {edit && <DocDialog key={(edit as any).id || 'new'} doc={edit === 'new' ? null : edit} docs={docs} folders={folderNames} defaultFolder={folder} onClose={() => setEdit(null)} />}
    </>
  );
}

function FolderBtn({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={cn('flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px]', active ? 'bg-copper-soft font-medium text-copper-strong' : 'hover:bg-sunken')}>
      <Folder className="size-4 shrink-0" /><span className="flex-1 truncate">{label}</span><span className="num text-[12px] text-ink-3">{n}</span>
    </button>
  );
}

function DocDialog({ doc, docs, folders, defaultFolder, onClose }: { doc: Doc | HrDocument | null; docs: Doc[]; folders: string[]; defaultFolder: string; onClose: () => void }) {
  const existing = doc && (doc as Doc).id ? (doc as Doc) : null;
  const init: HrDocument = useMemo(() => doc ? { title: doc.title, date: doc.date || todayISO(), content: doc.content || '', folder: doc.folder || '', signerLeft: doc.signerLeft || '', signerRight: doc.signerRight || '', images: doc.images || [] }
    : { title: defaultFolder ? nextTitle(docs, defaultFolder) : '', date: todayISO(), content: '', folder: defaultFolder, signerLeft: '', signerRight: 'La Direction', images: [] }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<HrDocument>(init);
  const set = <K extends keyof HrDocument>(k: K, v: HrDocument[K]) => setF((x) => ({ ...x, [k]: v }));
  const legacyHtml = isHtml(f.content);
  const [busy, setBusy] = useState(false);

  const changeFolder = (folder: string) => setF((x) => ({ ...x, folder, title: !existing && (!x.title || /n°\s*\d+\/\d{4}$/.test(x.title)) && folder ? nextTitle(docs, folder) : x.title }));
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    try { const urls = await Promise.all([...files].slice(0, 6).map((file) => fileToCompressedDataUrl(file, 1200, 0.8))); set('images', [...f.images, ...urls]); }
    catch (e: any) { toast.error(e.message); }
  };
  const save = async () => {
    if (!f.title.trim()) { toast.error('Donnez un titre au document'); return; }
    setBusy(true);
    try {
      if (existing) await saveChanges('hrDocuments', existing as any, init as any, f as any);
      else await createRecord('hrDocuments', f as any);
      toast.success(existing ? 'Document enregistré' : 'Document créé'); onClose();
    } catch { /* toast shown by the store */ } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" title={existing ? 'Modifier le document' : 'Nouveau document'} onSubmit={save}
      footer={<>
        <Button type="button" variant="ghost" icon={<Printer className="size-4" />} onClick={() => printHrDocument(f)} className="mr-auto">Aperçu impression</Button>
        <Button type="button" onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="primary" loading={busy}>{existing ? 'Enregistrer' : 'Créer le document'}</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Dossier">
          <Select value={f.folder} onChange={(e) => changeFolder(e.target.value)}>
            <option value="">Sans dossier</option>{folders.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
      </div>
      <Field label="Titre" required className="mt-3" hint={f.folder && !existing ? 'Numéro proposé automatiquement d’après le dossier.' : undefined}><Input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
      {legacyHtml ? (
        <Field label="Contenu" className="mt-3" hint="Document mis en forme dans l’ancienne application. Il s’imprime tel quel.">
          <div className="control max-h-72 overflow-y-auto p-3 text-[13.5px]" dangerouslySetInnerHTML={{ __html: sanitize(f.content) }} />
        </Field>
      ) : (
        <Field label="Contenu" className="mt-3"><Textarea rows={11} value={f.content} onChange={(e) => set('content', e.target.value)} placeholder="Rédigez le texte du document…" /></Field>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Signataire à gauche"><Input value={f.signerLeft} onChange={(e) => set('signerLeft', e.target.value)} placeholder="ex. L’intéressé" /></Field>
        <Field label="Signataire à droite"><Input value={f.signerRight} onChange={(e) => set('signerRight', e.target.value)} placeholder="ex. La Direction" /></Field>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-[13px] font-medium">Images jointes</div>
        <div className="flex flex-wrap gap-2">
          {f.images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={`Image ${i + 1}`} className="size-20 rounded-md border border-line object-cover" />
              <button type="button" aria-label="Retirer l’image" onClick={() => set('images', f.images.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 rounded-full bg-ink p-0.5 text-surface"><X className="size-3" /></button>
            </div>
          ))}
          <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-[11.5px] text-ink-3 hover:border-copper hover:text-copper-strong">
            <ImagePlus className="size-5" />Ajouter
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    </Dialog>
  );
}
