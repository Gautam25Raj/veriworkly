import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export interface ParityServer {
  origin: string;
  stop: () => Promise<void>;
}

const READY_TIMEOUT_MS = 180_000;

/**
 * `localhost`, never `127.0.0.1`.
 *
 * Next's dev server treats the two as different origins and blocks the second
 * from reaching anything under `/_next/` ("Blocked cross-origin request to
 * Next.js dev resource"). The page still renders and still returns 200, so the
 * harness sees a perfectly healthy document — but the dev client never
 * bootstraps, React never hydrates, and no effect ever runs. Every measurement
 * taken that way is of server-rendered markup that no browser code has touched.
 */
const HOST = "localhost";

/** Next refuses a second dev server for the same directory, so reuse one. */
const REUSE_PORTS = [4311, 3000, 3001];

/**
 * Boots the real app so the harness measures the real cascade — Tailwind
 * preflight, `app/globals.css`, the local `@font-face` rules. A hand-written
 * stylesheet in the test would only prove the test agrees with itself.
 */
export async function startParityServer(port = 4311): Promise<ParityServer> {
  for (const candidate of REUSE_PORTS) {
    const existing = `http://${HOST}:${candidate}`;

    if (await isReady(existing, 120_000)) return { origin: existing, stop: async () => {} };
  }

  const origin = `http://${HOST}:${port}`;

  const child: ChildProcess = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "dev", "-p", String(port)],
    { cwd: process.cwd(), stdio: "pipe", shell: process.platform === "win32" },
  );

  let log = "";
  child.stdout?.on("data", (chunk) => (log += String(chunk)));
  child.stderr?.on("data", (chunk) => (log += String(chunk)));

  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isReady(origin, 120_000)) {
      return { origin, stop: () => stopTree(child) };
    }

    if (child.exitCode !== null) {
      throw new Error(`next dev exited with ${child.exitCode}:\n${log}`);
    }

    await delay(500);
  }

  await stopTree(child);
  throw new Error(`next dev did not become ready in ${READY_TIMEOUT_MS}ms:\n${log}`);
}

/**
 * Kills the whole process tree, not just the child.
 *
 * On Windows the child is a `cmd.exe` running `npx`, and `child.kill()` only
 * reaps the shell — `next dev` survives, keeps the port, and the next run dies
 * with EADDRINUSE against a server that is no longer answering.
 */
async function stopTree(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return;

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
        .on("close", () => resolve())
        .on("error", () => resolve());
    });
  } else {
    child.kill();
  }

  await delay(300);
}

/**
 * The timeout has to cover a cold route compile, which is tens of seconds on a
 * dev server that has not served this page yet. Being generous costs nothing
 * when the port is free: the connection is refused immediately rather than
 * timing out. Probing with a short timeout instead makes the harness decide a
 * perfectly good server is dead and then fail to bind the port it is holding.
 */
async function isReady(origin: string, timeoutMs: number) {
  try {
    const response = await fetch(`${origin}/parity/resume/executive-clarity?mode=raw`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}
