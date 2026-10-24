import { execFileSync } from "node:child_process";
import path from "node:path";

import { applyServerEnv } from "./env.js";

/**
 * Runs once in the main process before any test file: brings the integration database to the
 * head of the migration history. `prisma migrate deploy` is idempotent, so a database that CI
 * already migrated is a no-op. The connection target comes from `env.ts` (local only).
 *
 * The CLI is invoked through its JavaScript entry with the current Node binary rather than the
 * `.bin` shim: on Windows the `.cmd` shim needs a shell and swallows the exit reason.
 */
export default function globalSetup() {
  const { databaseUrl } = applyServerEnv();
  const serverRoot = path.resolve(__dirname, "..", "..");
  const prismaEntry = require.resolve("prisma/build/index.js", { paths: [serverRoot] });

  execFileSync(process.execPath, [prismaEntry, "migrate", "deploy"], {
    cwd: serverRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
  });
}
