import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { PageRenderer } from "@/components/PageRenderer";
import { PageTreeNav } from "@/components/PageTreeNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { api, type Page, type Space } from "@/lib/api";
import { buildPageTree } from "@/lib/tree";

export function SpacePage() {
  const { spaceSlug = "", pageSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [space, setSpace] = useState<Space | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .space(spaceSlug)
      .then(async ({ space }) => {
        if (cancelled) return;
        setSpace(space);
        const pages = space.pages || [];
        const targetSlug = pageSlug || pages.find((p) => !p.parentId)?.slug || pages[0]?.slug;
        if (!targetSlug) {
          setPage(null);
          return;
        }
        if (!pageSlug) {
          navigate(`/s/${spaceSlug}/${targetSlug}`, { replace: true });
          return;
        }
        const { page } = await api.pageByPath(spaceSlug, targetSlug);
        if (!cancelled) setPage(page);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spaceSlug, pageSlug, navigate]);

  const tree = useMemo(() => buildPageTree(space?.pages || []), [space]);

  const canEdit = user?.role === "ADMIN" || user?.role === "EDITOR";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-[1400px] lg:grid-cols-[280px_1fr]">
      <aside className="border-r border-border bg-sidebar">
        <div className="border-b border-border px-4 py-4">
          <Link to="/" className="text-xs text-muted-foreground hover:underline">
            All spaces
          </Link>
          <h2 className="mt-1 font-semibold">{space?.name || "Space"}</h2>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {space?.description}
          </p>
        </div>
        <PageTreeNav tree={tree} spaceSlug={spaceSlug} activeSlug={pageSlug} />
      </aside>

      <section className="px-4 py-8 sm:px-8 lg:px-12">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && !page && (
          <div>
            <h1 className="font-serif text-3xl font-semibold">Empty space</h1>
            <p className="mt-2 text-muted-foreground">
              Add pages from the admin content panel.
            </p>
          </div>
        )}
        {page && (
          <article className="mx-auto max-w-3xl animate-in fade-in duration-300">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Badge>{page.editorType || "MARKDOWN"}</Badge>
              {page.author && (
                <span className="text-xs text-muted-foreground">
                  by {page.author.name}
                </span>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" className="ml-auto" asChild>
                  <Link to={`/admin/pages?edit=${page.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
            <PageRenderer
              content={page.content}
              editorType={page.editorType || "MARKDOWN"}
            />
          </article>
        )}
      </section>
    </div>
  );
}
