import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { PageRenderer } from "@/components/PageRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  api,
  type Page,
  type PageRevision,
  type PageRevisionSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const actionLabels: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  RESTORED: "Restored",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PageHistoryPanel({
  pageId,
  canRestore,
  onRestored,
}: {
  pageId: string;
  canRestore: boolean;
  onRestored: (page: Page) => void;
}) {
  const [revisions, setRevisions] = useState<PageRevisionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const { revisions: list } = await api.pageHistory(pageId);
      setRevisions(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setError("");
    api
      .pageRevision(pageId, selectedId)
      .then(({ revision }) => {
        if (!cancelled) setDetail(revision);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, selectedId]);

  async function onRestore() {
    if (!selectedId) return;
    const ok = window.confirm(
      "Restore this version? The current page content will be replaced and logged as a new history entry."
    );
    if (!ok) return;
    setRestoring(true);
    setError("");
    try {
      const { page } = await api.restorePageRevision(pageId, selectedId);
      await loadList();
      onRestored(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (!revisions.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 h-8 w-8 opacity-50" />
        No history yet. Revisions are recorded when you create or save a page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {revisions.map((rev) => (
            <button
              key={rev.id}
              type="button"
              onClick={() => setSelectedId(rev.id)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted",
                selectedId === rev.id && "bg-primary/10 text-primary"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="text-[10px]">
                  {actionLabels[rev.action] ?? rev.action}
                </Badge>
                {!rev.published && (
                  <Badge className="text-[10px]">Draft</Badge>
                )}
              </div>
              <p className="mt-1 font-medium">{rev.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatWhen(rev.createdAt)}
                {rev.editedBy ? ` · ${rev.editedBy.name}` : ""}
              </p>
            </button>
          ))}
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-background">
          {loadingDetail && (
            <p className="p-6 text-sm text-muted-foreground">Loading version…</p>
          )}
          {!loadingDetail && detail && (
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Version preview
                  </p>
                  <h3 className="font-serif text-xl font-semibold sm:text-2xl">
                    {detail.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(detail.createdAt)}
                    {detail.editedBy
                      ? ` · ${detail.editedBy.name} (@${detail.editedBy.username})`
                      : ""}
                  </p>
                </div>
                {canRestore && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={restoring}
                    onClick={onRestore}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {restoring ? "Restoring…" : "Restore"}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <PageRenderer
                  content={detail.content}
                  editorType={detail.editorType}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
