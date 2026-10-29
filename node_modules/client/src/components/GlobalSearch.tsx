import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth";
import {
  api,
  type SearchPageHit,
  type SearchResponse,
  type SearchSpaceHit,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 1;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={`${part}-${i}`}
            className="rounded-sm bg-primary/15 px-0.5 text-inherit dark:bg-primary/25"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        )
      )}
    </>
  );
}

type FlatItem =
  | { kind: "space"; hit: SearchSpaceHit }
  | { kind: "page"; hit: SearchPageHit };

function flattenResults(data: SearchResponse | null): FlatItem[] {
  if (!data) return [];
  return [
    ...data.spaces.map((hit) => ({ kind: "space" as const, hit })),
    ...data.pages.map((hit) => ({ kind: "page" as const, hit })),
  ];
}

function hrefFor(item: FlatItem): string {
  if (item.kind === "space") return `/s/${item.hit.slug}`;
  return `/s/${item.hit.spaceSlug}/${item.hit.slug}`;
}

function ResultsPanel({
  listId,
  query,
  loading,
  error,
  results,
  flat,
  activeIndex,
  setActiveIndex,
  onNavigate,
  className,
}: {
  listId: string;
  query: string;
  loading: boolean;
  error: string;
  results: SearchResponse | null;
  flat: FlatItem[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onNavigate: () => void;
  className?: string;
}) {
  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      className={cn(
        "z-50 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card shadow-lg",
        className
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}

      {!loading && error && (
        <p className="px-3 py-3 text-sm text-destructive">{error}</p>
      )}

      {!loading &&
        !error &&
        results &&
        !results.spaces.length &&
        !results.pages.length && (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No results found for “{results.query}”.
          </p>
        )}

      {!loading && !error && results && results.spaces.length > 0 && (
        <div className="border-b border-border py-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Spaces
          </p>
          {results.spaces.map((hit) => {
            const index = flat.findIndex(
              (f) => f.kind === "space" && f.hit.id === hit.id
            );
            const active = index === activeIndex;
            return (
              <Link
                key={hit.id}
                role="option"
                aria-selected={active}
                to={`/s/${hit.slug}`}
                className={cn(
                  "flex min-h-11 items-start gap-2.5 px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted/80"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={onNavigate}
              >
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    <Highlight text={hit.name} query={query} />
                  </span>
                  {hit.snippet ? (
                    <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      <Highlight text={hit.snippet} query={query} />
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && !error && results && results.pages.length > 0 && (
        <div className="py-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Pages
          </p>
          {results.pages.map((hit) => {
            const index = flat.findIndex(
              (f) => f.kind === "page" && f.hit.id === hit.id
            );
            const active = index === activeIndex;
            return (
              <Link
                key={hit.id}
                role="option"
                aria-selected={active}
                to={`/s/${hit.spaceSlug}/${hit.slug}`}
                className={cn(
                  "flex min-h-11 items-start gap-2.5 px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted/80"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={onNavigate}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    <Highlight text={hit.title} query={query} />
                    {!hit.published && (
                      <span className="ml-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        Hidden
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {hit.spaceName}
                    {hit.snippet ? " · " : ""}
                    {hit.snippet ? (
                      <Highlight text={hit.snippet} query={query} />
                    ) : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GlobalSearch({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const flat = flattenResults(results);
  const showPanel =
    open &&
    query.trim().length >= MIN_QUERY &&
    (loading || Boolean(error) || results !== null);

  const close = useCallback(() => {
    setOpen(false);
    setSheetOpen(false);
    setActiveIndex(0);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery("");
    setResults(null);
    setError("");
    setLoading(false);
    setActiveIndex(0);
  }, []);

  const focusInput = useCallback(() => {
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    requestAnimationFrame(() => {
      if (wide) desktopInputRef.current?.focus();
      else mobileInputRef.current?.focus();
    });
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }
    if (!api.getToken()) {
      setResults({ query: q, spaces: [], pages: [] });
      setError("Sign in to search manuals.");
      setLoading(false);
      return;
    }

    const id = ++reqIdRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await api.search(q);
      if (id !== reqIdRef.current) return;
      setResults(data);
      setActiveIndex(0);
    } catch (err) {
      if (id !== reqIdRef.current) return;
      setResults(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (id === reqIdRef.current) setLoading(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSearch(value);
      }, DEBOUNCE_MS);
    },
    [runSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModK =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isModK) {
        e.preventDefault();
        const wide = window.matchMedia("(min-width: 1024px)").matches;
        if (!wide) setSheetOpen(true);
        setOpen(true);
        focusInput();
        return;
      }
      if (e.key === "Escape" && (open || sheetOpen)) {
        e.preventDefault();
        close();
        desktopInputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, focusInput, open, sheetOpen]);

  useEffect(() => {
    if (sheetOpen) focusInput();
  }, [sheetOpen, focusInput]);

  const goTo = useCallback(
    (item: FlatItem) => {
      navigate(hrefFor(item));
      clearQuery();
      close();
    },
    [navigate, clearQuery, close]
  );

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!flat.length) return;
      setOpen(true);
      setActiveIndex((i) => (i + 1) % flat.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      setOpen(true);
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (flat[activeIndex]) {
        goTo(flat[activeIndex]);
        return;
      }
      void runSearch(query);
      setOpen(true);
    }
  }

  function onQueryChange(next: string) {
    setQuery(next);
    setOpen(true);
    scheduleSearch(next);
  }

  const onResultNavigate = () => {
    clearQuery();
    close();
  };

  const shortcutHint =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const renderField = (
    inputRef: React.RefObject<HTMLInputElement | null>,
    fieldClassName?: string
  ) => (
    <div className={cn("relative", fieldClassName)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder={user ? "Search spaces & pages…" : "Sign in to search…"}
        disabled={!user}
        className="h-10 pr-16 pl-9"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {query ? (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
            onClick={() => {
              clearQuery();
              inputRef.current?.focus();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:inline">
            {shortcutHint}
          </kbd>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn("contents", className)}>
      {/* Desktop inline search */}
      <div className="relative mx-auto hidden w-full max-w-md lg:block">
        {renderField(desktopInputRef)}
        {showPanel && (
          <ResultsPanel
            listId={listId}
            query={query}
            loading={loading}
            error={error}
            results={results}
            flat={flat}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            onNavigate={onResultNavigate}
            className="absolute top-[calc(100%+0.35rem)] right-0 left-0"
          />
        )}
      </div>

      {/* Mobile trigger + sheet */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open search"
          onClick={() => {
            setSheetOpen(true);
            setOpen(true);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>

        {sheetOpen && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-foreground/40"
              aria-label="Close search"
              onClick={close}
            />
            <div className="absolute inset-x-0 top-0 border-b border-border bg-background p-3 shadow-lg">
              <div className="mx-auto flex max-w-7xl items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  {renderField(mobileInputRef)}
                  {showPanel && (
                    <ResultsPanel
                      listId={`${listId}-mobile`}
                      query={query}
                      loading={loading}
                      error={error}
                      results={results}
                      flat={flat}
                      activeIndex={activeIndex}
                      setActiveIndex={setActiveIndex}
                      onNavigate={onResultNavigate}
                      className="absolute top-[calc(100%+0.35rem)] right-0 left-0"
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Close search"
                  onClick={close}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
