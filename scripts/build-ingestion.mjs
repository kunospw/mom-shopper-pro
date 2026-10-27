import { build } from "esbuild";
await build({ entryPoints: ["server/catalogue-http.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: "dist-server/catalogue-http.mjs", sourcemap: true });
console.log("Prepared dist-server/catalogue-http.mjs. No service started or deployed.");
