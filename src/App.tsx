import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();
const workspacePage = async () => ({
  Component: (await import("./pages/Index")).default,
});
const router = createBrowserRouter([
  {
    path: "/shop/:storeId",
    lazy: async () => ({
      Component: (await import("./pages/BuyerCatalog")).BuyerCatalog,
    }),
  },
  {
    lazy: async () => ({
      Component: (await import("./components/OwnerLayout")).OwnerLayout,
    }),
    children: [
      {
        path: "/login",
        lazy: async () => ({
          Component: (await import("./pages/Login")).Login,
        }),
      },
      {
        lazy: async () => ({
          Component: (await import("./components/OwnerLayout")).OwnerWorkspace,
        }),
        children: [
          { path: "/", lazy: workspacePage },
          { path: "/reports", lazy: workspacePage },
          {
            path: "/transactions",
            element: <Navigate to="/sales" replace />,
          },
          {
            path: "/sales",
            lazy: async () => ({
              Component: (await import("./pages/Sales")).default,
            }),
          },
          {
            path: "/costs",
            lazy: async () => ({
              Component: (await import("./pages/Costs")).default,
            }),
          },
          {
            path: "/customers",
            lazy: async () => ({
              Component: (await import("./pages/Customers")).default,
            }),
          },
          {
            path: "/catalog",
            lazy: async () => ({
              Component: (await import("./pages/Catalog")).Catalog,
            }),
          },
          {
            path: "/settings",
            element: <Navigate to="/settings/appearance" replace />,
          },
          {
            path: "/settings/:section",
            lazy: async () => ({
              Component: (await import("./pages/Profile")).Profile,
            }),
          },
          {
            path: "/profile",
            element: <Navigate to="/settings/business" replace />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RouterProvider
        router={router}
        fallbackElement={
          <p role="status" className="p-8 text-center">
            Memuat halaman…
          </p>
        }
      />
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
