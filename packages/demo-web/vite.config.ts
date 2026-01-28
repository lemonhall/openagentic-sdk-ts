import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      // Use workspace source directly so demo reflects latest changes without rebuilding dist outputs.
      "@openagentic/tools": resolve(fileURLToPath(new URL(".", import.meta.url)), "../tools/src/index.ts"),
    },
  },
});
