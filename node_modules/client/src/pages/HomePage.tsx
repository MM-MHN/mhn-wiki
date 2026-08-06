import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Book,
  Lock,
  Pencil,
  Plus,
  Rocket,
  Shield,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth";
import { api, type Space } from "@/lib/api";

const icons: Record<string, typeof Book> = {
  book: Book,
  rocket: Rocket,
  shield: Shield,
};

const ICON_OPTIONS = [
  { value: "book", label: "Book" },
  { value: "rocket", label: "Rocket" },
  { value: "shield", label: "Shield" },
] as const;

type SpaceFormState = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  isPrivate: boolean;
};

const emptyForm = (): SpaceFormState => ({
  name: "",
  slug: "",
  description: "",
  icon: "book",
  isPrivate: false,
});

export function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Space | null>(null);
  const [form, setForm] = useState<SpaceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadSpaces() {
    const { spaces } = await api.spaces();
    setSpaces(spaces);
  }

  useEffect(() => {
    loadSpaces()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(space: Space) {
    setEditing(space);
    setForm({
      name: space.name,
      slug: space.slug,
      description: space.description || "",
      icon: space.icon || "book",
      isPrivate: space.isPrivate,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        icon: form.icon,
        isPrivate: form.isPrivate,
      };
      if (editing) {
        await api.updateSpace(editing.id, payload);
      } else {
        await api.createSpace(payload);
      }
      await loadSpaces();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(space: Space) {
    if (!isAdmin) return;
    const ok = window.confirm(
      `Delete space “${space.name}”? All pages inside it will be removed.`
    );
    if (!ok) return;
    setDeletingId(space.id);
    setError("");
    try {
      await api.deleteSpace(space.id);
      await loadSpaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      <section className="mb-12 flex max-w-3xl flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <img
              src="/brand/logo.png"
              alt="Mahar NET"
              className="h-16 w-auto max-w-[220px] object-contain"
            />
          </div>
          <p className="mb-3 text-sm font-medium tracking-wide text-primary uppercase">
            User manual
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            MHN Wiki
          </h1>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New space
          </Button>
        )}
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading spaces…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => {
            const Icon = icons[space.icon || "book"] || Book;
            return (
              <Card
                key={space.id}
                className="group relative h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
              >
                {isAdmin && (
                  <div className="absolute top-3 right-3 z-10 flex gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit space"
                      onClick={() => openEdit(space)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      title="Delete space"
                      disabled={deletingId === space.id}
                      onClick={() => onDelete(space)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Link to={`/s/${space.slug}`} className="block h-full">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between pr-16">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      {space.isPrivate && (
                        <Badge>
                          <Lock className="mr-1 h-3 w-3" />
                          Private
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="flex items-center gap-2">
                      {space.name}
                      <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </CardTitle>
                    <CardDescription>
                      {space.description || "No description yet."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {space._count?.pages ?? 0} pages
                    </p>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit space" : "Create space"}
        description="Admin only. Spaces group related manual pages."
      >
        <form className="space-y-4" onSubmit={onSave}>
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-slug">Slug</Label>
            <Input
              id="space-slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="auto-from-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-description">Description</Label>
            <Textarea
              id="space-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="min-h-[88px]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="space-icon">Icon</Label>
              <select
                id="space-icon"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.icon}
                onChange={(e) =>
                  setForm((f) => ({ ...f, icon: e.target.value }))
                }
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPrivate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isPrivate: e.target.checked }))
                  }
                />
                Private space
              </label>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create space"}
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
