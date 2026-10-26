import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },

  test: {
    environment: "node",
    include: ["tests/contracts/**/*.test.ts", "tests/contracts/**/*.test.tsx"],
    globals: false,
    // Every test starts from the real implementations and globals, whatever the last one stubbed.
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    // Several contracts render real PDFs; under a full parallel run they pass the 5 s default.
    testTimeout: 20_000,
  },
});
