import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BusinessTheme } from "@/components/BusinessBrand";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { AppShell } from "@/components/AppShell";
import Index from "./pages/Index";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();
function RootLayout() {
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
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <Login /> },
      {
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { path: "/", element: <Index /> },
          { path: "/transactions", element: <Index /> },
          { path: "/reports", element: <Index /> },
          {
            path: "/settings",
            element: <Navigate to="/settings/appearance" replace />,
          },
          { path: "/settings/:section", element: <Profile /> },
          {
            path: "/profile",
            element: <Navigate to="/settings/business" replace />,
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
