import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Sun,
  Users,
  X,
} from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const [siteName, setSiteName] = useState("MHN Wiki");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then(({ settings }) => {
        if (settings.siteName) setSiteName(settings.siteName);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function onSignOut() {
    logout();
    navigate("/login");
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex min-h-11 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/80",
      isActive && "bg-muted text-foreground"
    );

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background dark:from-primary/20">
      {!isLoginPage && (
        <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
            <Link
              to="/"
              className="flex min-w-0 shrink-0 items-center gap-2 font-semibold tracking-tight sm:gap-2.5"
            >
              <img
                src="/brand/mark.png"
                alt="MHN"
                className="h-8 w-8 rounded-full object-contain bg-primary shadow-sm ring-1 ring-border sm:h-9 sm:w-9"
              />
              <span className="hidden truncate sm:inline">{siteName}</span>
            </Link>

            <GlobalSearch />

            <nav className="ml-auto hidden items-center gap-1 lg:flex">
              {user?.role === "ADMIN" && (
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/admin">
                    <LayoutDashboard className="h-4 w-4" />
                    Admin
                  </NavLink>
                </Button>
              )}
              {user?.role === "ADMIN" && (
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/admin/logs">
                    <ScrollText className="h-4 w-4" />
                    Logs
                  </NavLink>
                </Button>
              )}
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
                  <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground xl:inline">
                    {user.name}
                  </span>
                  <Button variant="outline" size="sm" onClick={onSignOut}>
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

            <div className="ml-auto flex items-center gap-0.5 lg:hidden">
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
              <Button
                variant="ghost"
                size="icon"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {menuOpen && (
            <nav className="animate-in fade-in slide-in-from-top-1 border-t border-border bg-background px-4 py-3 duration-200 sm:px-6 lg:hidden lg:px-8">
              <div className="mx-auto flex max-w-7xl flex-col gap-0.5">
                <NavLink to="/" className={navLinkClass}>
                  Spaces
                </NavLink>
                {user?.role === "ADMIN" && (
                  <NavLink to="/admin/logs" className={navLinkClass}>
                    <ScrollText className="h-4 w-4" />
                    System logs
                  </NavLink>
                )}
                {user?.role === "ADMIN" && (
                  <NavLink to="/admin" className={navLinkClass}>
                    <LayoutDashboard className="h-4 w-4" />
                    Admin
                  </NavLink>
                )}
                {(user?.role === "ADMIN" || user?.role === "EDITOR") && (
                  <NavLink to="/admin/pages" className={navLinkClass}>
                    <Users className="h-4 w-4" />
                    Content
                  </NavLink>
                )}
                {user ? (
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="truncate text-sm text-muted-foreground">
                      {user.name}
                    </span>
                    <Button variant="outline" size="sm" onClick={onSignOut}>
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="mt-2" asChild>
                    <Link to="/login">
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          )}
        </header>
      )}
      <Outlet />
    </div>
  );
}
