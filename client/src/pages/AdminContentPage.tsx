import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Eye, ExternalLink, History, Pencil } from "lucide-react";
import { PageHistoryPanel } from "@/components/PageHistoryPanel";
import { PageRenderer } from "@/components/PageRenderer";
import { WysiwygEditor } from "@/components/WysiwygEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth";
import { api, type EditorType, type Page, type Space } from "@/lib/api";
import { cn } from "@/lib/utils";

type PanelMode = "edit" | "preview" | "history";

export function AdminContentPage() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [editorType, setEditorType] = useState<EditorType>("WYSIWYG");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("edit");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const loadedEditRef = useRef<string | null>(null);

  const canAccess = user?.role === "ADMIN" || user?.role === "EDITOR";
  const editParam = params.get("edit");
  const viewParam = params.get("view");

  const fillForm = useCallback(
    (page: Page, options?: { showPreview?: boolean; showHistory?: boolean }) => {
      setEditingId(page.id);
      setSpaceId(page.spaceId);
      setTitle(page.title);
      setSlug(page.slug);
      setContent(page.content ?? "");
      setEditorType(page.editorType || "WYSIWYG");
      setParentId(page.parentId || "");
      setEditorKey((k) => k + 1);
      setMessage("");
      setError("");
      if (options?.showHistory) setPanelMode("history");
      else if (options?.showPreview) setPanelMode("preview");
    },
    []
  );

  const loadPageForEdit = useCallback(
    async (pageId: string, options?: { showHistory?: boolean }) => {
      setLoadingPage(true);
      setError("");
      if (!options?.showHistory) setPanelMode("edit");
      try {
        const { page } = await api.getPage(pageId);
        fillForm(page, { showHistory: options?.showHistory });
      } catch (err) {
        loadedEditRef.current = null;
        setError(err instanceof Error ? err.message : "Failed to load page");
      } finally {
        setLoadingPage(false);
      }
    },
    [fillForm]
  );

  async function loadSpaces() {
    let list: Space[] = [];
    if (user?.role === "ADMIN") {
      try {
        const admin = await api.adminSpaces();
        list = admin.spaces;
      } catch {
        const r = await api.spaces();
        list = r.spaces;
      }
    } else {
      const r = await api.spaces();
      list = r.spaces.filter(
        (s) => s.myAccess === "EDIT" || s.myAccess === "MANAGE"
      );
      list = await Promise.all(
        list.map(async (s) => {
          const detail = await api.space(s.slug);
          return detail.space;
        })
      );
    }
    setSpaces(list);
    return list;
  }

  useEffect(() => {
    if (!canAccess) return;
    loadSpaces()
      .then((list) => {
        if (!editParam) {
          setSpaceId((current) => current || list[0]?.id || "");
        }
      })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess || !editParam) return;
    const key = `${editParam}:${viewParam ?? ""}`;
    if (loadedEditRef.current === key) return;
    loadedEditRef.current = key;
    void loadPageForEdit(editParam, { showHistory: viewParam === "history" });
  }, [canAccess, editParam, viewParam, loadPageForEdit]);

  const selected = useMemo(
    () => spaces.find((s) => s.id === spaceId),
    [spaces, spaceId]
  );

  const livePath = useMemo(() => {
    if (!selected?.slug || !slug) return null;
    return `/s/${selected.slug}/${slug}`;
  }, [selected?.slug, slug]);

  if (loading) return null;
  if (!user || !canAccess) return <Navigate to="/login" replace />;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingId) {
        const { page } = await api.updatePage(editingId, {
          title,
          slug,
          content,
          editorType,
          parentId: parentId || null,
        });
        fillForm(page, { showPreview: true });
        setMessage("Page updated. Preview is shown below.");
      } else {
        const { page } = await api.createPage({
          spaceId,
          title,
          slug: slug || undefined,
          content,
          editorType,
          parentId: parentId || null,
        });
        fillForm(page, { showPreview: true });
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("edit", page.id);
            return next;
          },
          { replace: true }
        );
        setMessage("Page created. Preview is shown below.");
      }
      await loadSpaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function createSpace(e: FormEvent) {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    try {
      const { space } = await api.createSpace({ name: newSpaceName });
      setNewSpaceName("");
      await loadSpaces();
      setSpaceId(space.id);
      setMessage(`Space “${space.name}” created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create space");
    }
  }

  function startEdit(pageId: string) {
    loadedEditRef.current = null;
    setPanelMode("edit");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("edit", pageId);
        return next;
      },
      { replace: true }
    );
  }

  function resetForm() {
    loadedEditRef.current = null;
    setEditingId(null);
    setTitle("");
    setSlug("");
    setContent("");
    setParentId("");
    setEditorType("WYSIWYG");
    setEditorKey((k) => k + 1);
    setPanelMode("edit");
    setMessage("");
    setError("");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      },
      { replace: true }
    );
  }

  function onEditorTypeChange(next: EditorType) {
    setEditorType(next);
    setEditorKey((k) => k + 1);
  }

  return (
    <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:py-10 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Spaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={spaceId}
              onChange={(e) => {
                setSpaceId(e.target.value);
                resetForm();
              }}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {user?.role === "ADMIN" && (
              <form className="flex min-w-0 gap-2" onSubmit={createSpace}>
                <Input
                  className="min-w-0 flex-1"
                  placeholder="New space name"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                />
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages in space</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(selected?.pages || []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => startEdit(p.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                  editingId === p.id && "bg-primary/10 text-primary"
                )}
              >
                <span className={p.parentId ? "pl-4" : ""}>{p.title}</span>
                <span className="text-xs text-muted-foreground">{p.editorType}</span>
              </button>
            ))}
            {!selected?.pages?.length && (
              <p className="text-sm text-muted-foreground">No pages yet.</p>
            )}
            <Button variant="outline" className="mt-2 w-full" onClick={resetForm}>
              New page
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:flex-wrap sm:items-center">
          <CardTitle className="min-w-0 break-words">
            {loadingPage
              ? "Loading page…"
              : panelMode === "history" && editingId
                ? `History: ${title || "Untitled"}`
                : editingId
                  ? `${panelMode === "preview" ? "Preview" : "Edit"}: ${title || "Untitled"}`
                  : "Create page"}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={panelMode === "edit" ? "default" : "ghost"}
                onClick={() => setPanelMode("edit")}
                disabled={!editingId}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant={panelMode === "preview" ? "default" : "ghost"}
                onClick={() => setPanelMode("preview")}
                disabled={!editingId}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                variant={panelMode === "history" ? "default" : "ghost"}
                onClick={() => setPanelMode("history")}
                disabled={!editingId}
              >
                <History className="h-3.5 w-3.5" />
                History
              </Button>
            </div>
            {livePath && editingId && (
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to={livePath} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View live
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {panelMode === "history" && editingId ? (
            <PageHistoryPanel
              pageId={editingId}
              canRestore
              onRestored={(page) => {
                fillForm(page);
                setPanelMode("edit");
                setMessage("Version restored.");
                void loadSpaces();
              }}
            />
          ) : panelMode === "preview" ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-border bg-background px-4 py-6 sm:px-6 sm:py-8">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reader preview
                </p>
                <h1 className="mb-6 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title || "Untitled"}
                </h1>
                {content.trim() ? (
                  <PageRenderer content={content} editorType={editorType} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No content yet. Switch to Edit and write something.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setPanelMode("edit")}>
                  <Pencil className="h-4 w-4" />
                  Back to edit
                </Button>
                {livePath && editingId && (
                  <Button type="button" variant="outline" asChild>
                    <Link to={livePath}>Open in space</Link>
                  </Button>
                )}
              </div>
              {message && <p className="text-sm text-primary">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={loadingPage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-from-title"
                    disabled={loadingPage}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editor">Editor type</Label>
                  <select
                    id="editor"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={editorType}
                    disabled={loadingPage}
                    onChange={(e) =>
                      onEditorTypeChange(e.target.value as EditorType)
                    }
                  >
                    <option value="WYSIWYG">WYSIWYG</option>
                    <option value="MARKDOWN">Markdown</option>
                    <option value="HTML">Raw HTML</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent page</Label>
                  <select
                    id="parent"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={parentId}
                    disabled={loadingPage}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">None (root)</option>
                    {(selected?.pages || [])
                      .filter((p) => p.id !== editingId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                {loadingPage ? (
                  <div className="flex min-h-[240px] items-center justify-center rounded-md border border-input text-sm text-muted-foreground sm:min-h-[320px]">
                    Loading page content…
                  </div>
                ) : editorType === "WYSIWYG" ? (
                  <WysiwygEditor
                    key={`${editingId ?? "new"}-${editorKey}`}
                    value={content}
                    onChange={setContent}
                    placeholder="Write your manual page…"
                  />
                ) : (
                  <Textarea
                    id="content"
                    className="min-h-[240px] font-mono text-sm sm:min-h-[320px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      editorType === "HTML"
                        ? "<h1>Manual content…</h1>"
                        : "# Manual content…"
                    }
                  />
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-primary">{message}</p>}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loadingPage}>
                  {editingId ? "Save changes" : "Create page"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loadingPage}
                  onClick={() => setPanelMode("preview")}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
