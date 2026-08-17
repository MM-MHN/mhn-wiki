import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { History, Menu, Pencil, X } from "lucide-react";
import { PageRenderer } from "@/components/PageRenderer";
import { PageTreeNav } from "@/components/PageTreeNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type Page, type Space } from "@/lib/api";
import { buildPageTree } from "@/lib/tree";
import { cn } from "@/lib/utils";

export function SpacePage() {
  const { spaceSlug = "", pageSlug } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState<Space | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);

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

  useEffect(() => {
    setNavOpen(false);
  }, [pageSlug]);

  const tree = useMemo(() => buildPageTree(space?.pages || []), [space]);

  const canEdit =
    space?.myAccess === "EDIT" || space?.myAccess === "MANAGE";

  return (
    <div className="relative mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-[1400px] lg:grid-cols-[280px_1fr]">
      {navOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          aria-label="Close page list"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={cn(
          "z-40 flex flex-col border-border bg-sidebar",
          "max-lg:fixed max-lg:inset-y-14 max-lg:left-0 max-lg:w-[min(20rem,88vw)] max-lg:border-r max-lg:shadow-lg max-lg:transition-transform",
          navOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "lg:static lg:translate-x-0 lg:border-r"
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-4">
          <div className="min-w-0">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              All spaces
            </Link>
            <h2 className="mt-1 font-semibold">{space?.name || "Space"}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {space?.description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            aria-label="Close page list"
            onClick={() => setNavOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PageTreeNav tree={tree} spaceSlug={spaceSlug} activeSlug={pageSlug} />
        </div>
      </aside>

      <section className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-4 w-4" />
            Pages
          </Button>
          {space?.name && (
            <span className="truncate text-sm text-muted-foreground">
              {space.name}
            </span>
          )}
        </div>

        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && !page && (
          <div>
            <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Empty space</h1>
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
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/pages?edit=${page.id}&view=history`}>
                      <History className="h-3.5 w-3.5" />
                      History
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/pages?edit=${page.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                </div>
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
