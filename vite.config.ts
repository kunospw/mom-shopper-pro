import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Dev only: serves POST /api/shop-chat with the same handler as the Vercel
 * function (api/shop-chat.ts), so the shop assistant works under `npm run dev`
 * and in the emulator tests. Not part of the production build.
 */
function shopChatDev(mode: string): Plugin {
  return {
    name: "shop-chat-dev",
    apply: "serve",
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
      server.middlewares.use("/api/shop-chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body: unknown = null;
        try {
          body = JSON.parse(raw);
        } catch {
          /* rejected by the handler */
        }
        const { handleShopChat } = await server.ssrLoadModule("/server/shop-chat.ts");
        const result = await handleShopChat(body, { ip: req.socket.remoteAddress ?? "local", env });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), shopChatDev(mode), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
