import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState("MHN Wiki");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .settings()
      .then(({ settings }) => {
        if (settings.siteName) setSiteName(settings.siteName);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background dark:from-primary/20">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <img
              src="/brand/mark.png"
              alt="MHN"
              className="h-9 w-9 rounded-full object-contain bg-primary shadow-sm ring-1 ring-border"
            />
            <span className="hidden sm:inline">{siteName}</span>
          </Link>

          <div className="relative mx-auto hidden w-full max-w-md md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search manuals (frame)"
              className="pl-9"
            />
          </div>

          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(isActive && "bg-muted text-foreground")
                }
              >
                Spaces
              </NavLink>
            </Button>
            {user?.role === "ADMIN" && (
              <Button variant="ghost" size="sm" asChild>
                <NavLink to="/admin">
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                </NavLink>
              </Button>
            )}
            {(user?.role === "ADMIN" || user?.role === "EDITOR") && (
              <Button variant="ghost" size="sm" asChild>
                <NavLink to="/admin/pages">
                  <Users className="h-4 w-4" />
                  Content
                </NavLink>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {user ? (
              <div className="flex items-center gap-2 pl-2">
                <span className="hidden text-sm text-muted-foreground lg:inline">
                  {user.name}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <Button size="sm" asChild>
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
