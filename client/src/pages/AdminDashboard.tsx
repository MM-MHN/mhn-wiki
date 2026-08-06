import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, FileText, Users, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

export function AdminDashboard() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api.adminOverview().then((r) => setStats(r.stats)).catch(() => undefined);
  }, [user]);

  if (loading) return null;
  if (!user || user.role !== "ADMIN") return <Navigate to="/login" replace />;

  const items = [
    { key: "spaces", label: "Spaces", icon: BookOpen, to: "/admin/pages" },
    { key: "pages", label: "Pages", icon: FileText, to: "/admin/pages" },
    { key: "users", label: "Users", icon: Users, to: "/admin/users" },
    { key: "groups", label: "Groups", icon: UsersRound, to: "/admin/users" },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Manage spaces, pages, users, and groups. Content is seed data — replace with yours.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} to={item.to}>
              <Card className="transition hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {item.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{stats?.[item.key] ?? "—"}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Frame roadmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Spaces + nested page tree (Docmost-style)</p>
            <p>✓ Markdown / HTML editor types (Wiki.js-style switch)</p>
            <p>✓ Roles: Admin / Editor / Viewer + groups model</p>
            <p>✓ Light / dark mode reader UI</p>
            <p>○ Real-time collaborative WYSIWYG</p>
            <p>○ OAuth / LDAP / SAML providers</p>
            <p>○ Mermaid / Draw.io / Excalidraw embeds</p>
            <p>○ Git sync for content backup</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className="text-primary underline-offset-4 hover:underline" to="/admin/pages">
              Edit content
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/admin/users">
              Manage users & groups
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/">
              View reader home
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
