import js from "@eslint/js";
import ts from "typescript-eslint";

const eslintConfig = [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        // Type-aware, for the two promise rules below (the root config carries the same block).
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // A floating promise ends as an unhandledRejection, which shuts the worker down.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];

export default eslintConfig;
