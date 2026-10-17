/**
 * Dev server for the mocked browser tests: the real app, with the storage
 * and auth modules swapped for in-memory/localStorage mocks (no network,
 * no Firebase). Grace period is pushed far out so legacy shops stay open.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const mock = (file: string) => path.join(here, file);

export default defineConfig({
  root: repo,
  server: { port: 8099, strictPort: true, fs: { allow: [repo] } },
  preview: { port: 8097, strictPort: true },
  define: { "import.meta.env.VITE_GRACE_END": JSON.stringify("2999-01-01T00:00:00Z") },
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/contexts/AuthContext", replacement: mock("auth.tsx") },
      { find: "@/lib/books-storage", replacement: mock("books-storage.ts") },
      { find: "@/lib/catalog-owner-storage", replacement: mock("catalog-owner.ts") },
      { find: "@/lib/entitlement-storage", replacement: mock("entitlement-storage.ts") },
      { find: "@/lib/orders-owner-storage", replacement: mock("orders-owner.ts") },
      { find: "@/lib/catalog-public-storage", replacement: mock("catalog-public.ts") },
      { find: "@", replacement: path.join(repo, "src") },
    ],
  },
});
