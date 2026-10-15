import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BusinessTheme } from "@/components/BusinessBrand";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
export function OwnerLayout() {
  return (
    <AuthProvider>
      <AppearanceProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BusinessTheme />
        <Outlet />
      </AppearanceProvider>
    </AuthProvider>
  );
}
export function OwnerWorkspace() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}
