import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { api, type SystemLog, type SystemLogCategory } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<SystemLogCategory | "ALL"> = [
  "ALL",
  "AUTH",
  "SPACE",
  "PAGE",
  "USER",
  "GROUP",
  "ACCESS",
];

const categoryLabels: Record<SystemLogCategory, string> = {
  AUTH: "Auth",
  SPACE: "Space",
  PAGE: "Page",
  USER: "User",
  GROUP: "Group",
  ACCESS: "Access",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminSystemLogsPage() {
  const { user, loading } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<SystemLogCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState("");
  const limit = 50;

  const load = useCallback(async () => {
    setLoadingLogs(true);
    setError("");
    try {
      const result = await api.adminSystemLogs({
        category: category === "ALL" ? undefined : category,
        q: query || undefined,
        limit,
        offset,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [category, query, offset]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    void load();
  }, [user, load]);

  if (loading) return null;
  if (!user || user.role !== "ADMIN") return <Navigate to="/login" replace />;

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-2xl font-semibold sm:text-3xl">
              System logs
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Audit trail of sign-ins, content changes, user/group management, and
            space access updates. Admin only.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loadingLogs}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("h-4 w-4", loadingLogs && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="log-category">Category</Label>
            <select
              id="log-category"
              className="h-10 w-full min-w-[10rem] rounded-md border border-input bg-card px-3 text-sm"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as SystemLogCategory | "ALL");
                setOffset(0);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All categories" : categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={onSearchSubmit}>
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="log-search">Search</Label>
              <Input
                id="log-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Message, user, target, action…"
              />
            </div>
            <Button type="submit" className="mt-auto">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Events {total ? `(${total})` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingLogs && (
            <p className="text-sm text-muted-foreground">Loading logs…</p>
          )}
          {!loadingLogs && !logs.length && (
            <p className="text-sm text-muted-foreground">
              No log entries yet. Actions such as sign-in, page saves, and admin
              changes will appear here.
            </p>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-md border border-border px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{categoryLabels[log.category]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(log.createdAt)}
                </span>
                {log.actorName && (
                  <span className="text-xs text-muted-foreground">
                    · {log.actorName}
                    {log.actorRole ? ` (${log.actorRole})` : ""}
                  </span>
                )}
              </div>
              <p className="mt-1 font-medium">{log.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {log.action}
                {log.targetLabel ? ` · ${log.targetType}: ${log.targetLabel}` : ""}
              </p>
            </div>
          ))}

          {total > limit && (
            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={offset === 0 || loadingLogs}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={offset + limit >= total || loadingLogs}
                onClick={() => setOffset((o) => o + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What gets logged</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p><strong className="text-foreground">Auth:</strong> user sign-in</p>
          <p><strong className="text-foreground">Space:</strong> create, update, delete</p>
          <p><strong className="text-foreground">Page:</strong> create, update, delete, restore</p>
          <p><strong className="text-foreground">User / Group:</strong> admin CRUD</p>
          <p><strong className="text-foreground">Access:</strong> space permission grant, change, revoke</p>
        </CardContent>
      </Card>
    </main>
  );
}
