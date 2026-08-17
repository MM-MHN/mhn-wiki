import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthProvider } from "@/context/auth";
import { ThemeProvider } from "@/context/theme";
import { AdminContentPage } from "@/pages/AdminContentPage";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminSystemLogsPage } from "@/pages/AdminSystemLogsPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { SpacePage } from "@/pages/SpacePage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="login" element={<LoginPage />} />
              <Route
                index
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
              <Route
                path="s/:spaceSlug"
                element={
                  <RequireAuth>
                    <SpacePage />
                  </RequireAuth>
                }
              />
              <Route
                path="s/:spaceSlug/:pageSlug"
                element={
                  <RequireAuth>
                    <SpacePage />
                  </RequireAuth>
                }
              />
              <Route
                path="admin"
                element={
                  <RequireAuth roles={["ADMIN"]}>
                    <AdminDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="admin/pages"
                element={
                  <RequireAuth roles={["ADMIN", "EDITOR"]}>
                    <AdminContentPage />
                  </RequireAuth>
                }
              />
              <Route
                path="admin/logs"
                element={
                  <RequireAuth roles={["ADMIN"]}>
                    <AdminSystemLogsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="admin/users"
                element={
                  <RequireAuth roles={["ADMIN"]}>
                    <AdminUsersPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
