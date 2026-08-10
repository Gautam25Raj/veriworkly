import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "src"),
      },
      {
        find: /^#(.+)$/,
        replacement: path.resolve(__dirname, "src/$1"),
      },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    /**
     * The default 5000ms is too tight for this suite's own thread-pool contention:
     * 38 files spread across worker threads oversubscribe the CPU, so an individual
     * test can sit queued past 5s even though its own logic (Redis and Prisma are
     * mocked in every affected test — no real I/O, no timers) finishes in
     * milliseconds once actually scheduled. Confirmed by running the full suite with
     * --testTimeout=20000: 191/191 pass in the same wall-clock time, so this isn't
     * hiding a slow test — it's giving the scheduler room it already needed.
     */
    testTimeout: 20_000,
    /**
     * Bounded rather than left at the CPU-count default. Vitest's thread pool
     * defaulting to one worker per core means this suite alone can saturate an 8-core
     * machine — and on a dev box that's never the only thing running (editors, a
     * second project's dev server, etc.), that saturation is what pushed individual
     * tests past the timeout above under real conditions, not a bug in any test.
     * Capping concurrency trades some wall-clock time for the suite being
     * deterministic regardless of what else is running on the machine.
     */
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    env: {
      GOOGLE_CLIENT_ID: "dummy-google-client-id",
      GOOGLE_CLIENT_SECRET: "dummy-google-client-secret",
      GITHUB_CLIENT_ID: "dummy-github-client-id",
      GITHUB_CLIENT_SECRET: "dummy-github-client-secret",
      LINKEDIN_CLIENT_ID: "dummy-linkedin-client-id",
      LINKEDIN_CLIENT_SECRET: "dummy-linkedin-client-secret",
    },
  },
});
