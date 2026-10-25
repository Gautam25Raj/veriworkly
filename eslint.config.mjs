import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/.source/**",
    "next-env.d.ts",
    "**/server/dist/**",
    "packages/*/dist/**",
    ".agents/**",
    ".claude/**",
  ]),

  {
    settings: {
      next: {
        rootDir: [
          "apps/site/",
          "apps/studio/",
          "apps/docs-platform/",
          "apps/blog-platform/",
          "apps/portfolio/",
        ],
      },
    },

    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  // The API server only: a floating promise there becomes an `unhandledRejection`, which shuts
  // the worker down. Type-aware, so it is scoped to the server's sources and the other
  // workspaces lint as before (apps/server/eslint.config.mjs carries the same rules).
  {
    files: ["apps/server/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./apps/server/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
]);

export default eslintConfig;
