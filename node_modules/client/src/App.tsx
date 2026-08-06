import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/context/auth";
import { ThemeProvider } from "@/context/theme";
import { AdminContentPage } from "@/pages/AdminContentPage";
import { AdminDashboard } from "@/pages/AdminDashboard";
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
              <Route index element={<HomePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="s/:spaceSlug" element={<SpacePage />} />
              <Route path="s/:spaceSlug/:pageSlug" element={<SpacePage />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/pages" element={<AdminContentPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
