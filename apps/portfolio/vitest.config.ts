import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `next/font/google` is a build-time transform, not a runtime module —
      // outside `next build` its exports aren't callable, so every template
      // that loads a typeface fails to import. See the stub for details.
      "next/font/google": fileURLToPath(
        new URL("./tests/stubs/next-font-google.ts", import.meta.url),
      ),
    },
  },
  test: { environment: "node" },
});
