import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { SkeletonPage } from '@/components/Skeleton';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/lib/queries';
import { Pin, PinOff, Pencil, Trash2, Search, Plus, X, StickyNote } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// Highlight color options. Each maps to card background + border classes that
// work in both light and dark mode.
const COLORS: { key: string; label: string; swatch: string; card: string }[] = [
  { key: '', label: 'Default', swatch: 'bg-card border-border', card: 'bg-card border-border' },
  { key: 'yellow', label: 'Yellow', swatch: 'bg-yellow-300', card: 'bg-yellow-100 dark:bg-yellow-500/15 border-yellow-300 dark:border-yellow-500/30' },
  { key: 'green', label: 'Green', swatch: 'bg-green-300', card: 'bg-green-100 dark:bg-green-500/15 border-green-300 dark:border-green-500/30' },
  { key: 'blue', label: 'Blue', swatch: 'bg-blue-300', card: 'bg-blue-100 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/30' },
  { key: 'pink', label: 'Pink', swatch: 'bg-pink-300', card: 'bg-pink-100 dark:bg-pink-500/15 border-pink-300 dark:border-pink-500/30' },
  { key: 'purple', label: 'Purple', swatch: 'bg-purple-300', card: 'bg-purple-100 dark:bg-purple-500/15 border-purple-300 dark:border-purple-500/30' },
  { key: 'orange', label: 'Orange', swatch: 'bg-orange-300', card: 'bg-orange-100 dark:bg-orange-500/15 border-orange-300 dark:border-orange-500/30' },
];

const cardClassFor = (color: string) =>
  COLORS.find((c) => c.key === color)?.card ?? COLORS[0].card;

const emptyDraft = { id: '', title: '', content: '', color: '', tags: [] as string[], pinned: false };

export default function Notes() {
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [tagInput, setTagInput] = useState('');
  const { toast } = useToast();

  const { data: notes = [], isLoading } = useNotes();
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  // Filter and sort notes locally
  const filteredNotes = useMemo(() => {
    let filtered = notes as Note[];

    // Apply search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (n: Note) =>
          (n.title && n.title.toLowerCase().includes(query)) ||
          (n.content && n.content.toLowerCase().includes(query)) ||
          n.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply color filter
    if (colorFilter) {
      filtered = filtered.filter((n: Note) => n.color === colorFilter);
    }

    return filtered;
  }, [notes, search, colorFilter]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setTagInput('');
    setDialogOpen(true);
  };

  const openEdit = (note: Note) => {
    setDraft({
      id: note.id,
      title: note.title ?? '',
      content: note.content ?? '',
      color: note.color ?? '',
      tags: note.tags ?? [],
      pinned: note.pinned ?? false,
    });
    setTagInput('');
    setDialogOpen(true);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!draft.tags.includes(t)) {
      setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== tag) }));
  };

  const saveNote = async () => {
    if (!draft.title.trim() && !draft.content.trim()) {
      toast({ title: 'Nothing to save', description: 'Add a title or some content first.', variant: 'destructive' });
      return;
    }
    const payload = {
      title: draft.title.trim(),
      content: draft.content,
      color: draft.color,
      tags: draft.tags,
      pinned: draft.pinned,
    };
    try {
      if (draft.id) {
        await updateNoteMutation.mutateAsync({ id: draft.id, data: payload });
      } else {
        await createNoteMutation.mutateAsync(payload);
      }
      toast({ title: draft.id ? 'Note updated' : 'Note saved' });
      setDialogOpen(false);
    } catch {
      toast({ title: 'Could not save note', variant: 'destructive' });
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await updateNoteMutation.mutateAsync({
        id: note.id,
        data: { pinned: !note.pinned },
      });
    } catch {
      toast({ title: 'Could not update note', variant: 'destructive' });
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await deleteNoteMutation.mutateAsync(note.id);
      toast({ title: 'Note deleted' });
    } catch {
      toast({ title: 'Could not delete note', variant: 'destructive' });
    }
  };

  // Split into pinned notes and the rest grouped date-wise (by createdAt day).
  const pinned = useMemo(() => (filteredNotes as Note[]).filter((n) => n.pinned), [filteredNotes]);

  const groupedByDate = useMemo(() => {
    const groups: { label: string; key: string; items: Note[] }[] = [];
    const map = new Map<string, Note[]>();
    for (const note of (filteredNotes as Note[]).filter((n) => !n.pinned)) {
      const d = new Date(note.createdAt);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    for (const key of sortedKeys) {
      groups.push({ key, label: formatDateLabel(key), items: map.get(key)! });
    }
    return groups;
  }, [filteredNotes]);

  const hasNotes = filteredNotes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Notepad</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Note
        </Button>
      </div>

      {/* Search + color filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes, content or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setColorFilter('')}
            className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
              colorFilter === '' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
            }`}
          >
            All
          </button>
          {COLORS.filter((c) => c.key).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColorFilter(colorFilter === c.key ? '' : c.key)}
              title={c.label}
              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${c.swatch} ${
                colorFilter === c.key ? 'ring-2 ring-offset-2 ring-primary ring-offset-background border-white' : 'border-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      {isLoading && <SkeletonPage rows={4} />}

      {!isLoading && !hasNotes && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <StickyNote className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">
              {search || colorFilter ? 'No notes match your search' : 'No notes yet'}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search || colorFilter
                ? 'Try a different keyword or clear the color filter.'
                : 'Jot down anything you need to remember. Highlight with colors, add tags, and pin the important ones.'}
            </p>
            {!(search || colorFilter) && (
              <Button onClick={openCreate} className="gap-2 mt-2">
                <Plus className="h-4 w-4" /> Create your first note
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && pinned.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Pin className="h-4 w-4" /> Pinned
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={openEdit}
                onDelete={handleDeleteNote}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        </section>
      )}

      {!isLoading &&
        groupedByDate.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{group.items.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={openEdit}
                  onDelete={handleDeleteNote}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          </section>
        ))}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit Note' : 'New Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="Optional title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                placeholder="Write anything you need to remember..."
                value={draft.content}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                className="min-h-[140px]"
              />
            </div>

            {/* Color highlight */}
            <div className="space-y-1.5">
              <Label>Highlight color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.key || 'default'}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, color: c.key }))}
                    title={c.label}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${c.swatch} ${
                      draft.color === c.key ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="note-tag">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="note-tag"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {draft.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Pin this note to the top
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={createNoteMutation.isPending || updateNoteMutation.isPending}>
              {createNoteMutation.isPending || updateNoteMutation.isPending ? 'Saving...' : draft.id ? 'Save changes' : 'Save note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  onEdit: (n: Note) => void;
  onDelete: (n: Note) => void;
  onTogglePin: (n: Note) => void;
}) {
  return (
    <div className={`group rounded-xl border p-4 flex flex-col gap-2 transition-shadow hover:shadow-md ${cardClassFor(note.color)}`}>
      <div className="flex items-start justify-between gap-2">
        {note.title ? (
          <h3 className="font-semibold leading-tight break-words">{note.title}</h3>
        ) : (
          <span className="text-sm text-muted-foreground italic">Untitled</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            title={note.pinned ? 'Unpin' : 'Pin'}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
          >
            {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(note)}
            title="Edit"
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            title="Delete"
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {note.content && (
        <p className="text-sm whitespace-pre-wrap break-words text-foreground/80 line-clamp-[10]">{note.content}</p>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-auto pt-1">
        {new Date(note.updatedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}

function formatDateLabel(key: string): string {
  const date = new Date(key + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}
