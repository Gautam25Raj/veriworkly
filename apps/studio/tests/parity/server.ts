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

/**
 * Boots the real app so the harness measures the real cascade — Tailwind
 * preflight, `app/globals.css`, the local `@font-face` rules. A hand-written
 * stylesheet in the test would only prove the test agrees with itself.
 *
 * A server that is already running is used only when `PARITY_ORIGIN` names it
 * (for example `PARITY_ORIGIN=http://localhost:3001`). Guessing by port measured
 * whatever answered there, including another app or another worktree.
 */
export async function startParityServer(port = 4311): Promise<ParityServer> {
  const reuse = process.env.PARITY_ORIGIN;

  if (reuse) {
    if (!(await isReady(reuse, 120_000))) {
      throw new Error(`PARITY_ORIGIN=${reuse} did not serve the parity route.`);
    }

    return { origin: reuse, stop: async () => {} };
  }

  const origin = `http://${HOST}:${port}`;

  if (await answers(origin)) {
    throw new Error(
      `Port ${port} is already in use. Stop that server (PowerShell: ` +
        `Get-NetTCPConnection -State Listen -LocalPort ${port} | ` +
        `ForEach-Object { taskkill /PID $_.OwningProcess /T /F }), ` +
        `or set PARITY_ORIGIN to reuse a studio dev server on purpose.`,
    );
  }

  const child: ChildProcess = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "dev", "-p", String(port)],
    {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: process.platform === "win32",
      // Own process group on POSIX so stopTree can signal `next dev`, not just `npx`.
      detached: process.platform !== "win32",
    },
  );

  // Registered before waiting: if the hook times out, the run still kills what it started.
  const stop = () => stopTree(child);
  process.once("exit", () => killTreeSync(child));

  let log = "";
  child.stdout?.on("data", (chunk) => (log += String(chunk)));
  child.stderr?.on("data", (chunk) => (log += String(chunk)));

  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      // Next's dev lock names the PID of the server already running in this directory.
      throw new Error(`next dev exited with ${child.exitCode}:\n${log}`);
    }

    // Generous per probe: the first request compiles the route, which takes tens of seconds.
    if (await isReady(origin, 120_000)) return { origin, stop };

    await delay(500);
  }

  await stop();
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
    killGroup(child.pid);
  }

  await delay(300);
}

function killTreeSync(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    killGroup(child.pid);
  }
}

function killGroup(pid: number) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

/** Anything listening at all. A refused connection fails at once, so this costs nothing when the port is free. */
async function answers(origin: string) {
  try {
    await fetch(origin, { signal: AbortSignal.timeout(5_000) });
    return true;
  } catch (error) {
    // A timeout means something accepted the connection and is hung: the port is still taken.
    return error instanceof DOMException && error.name === "TimeoutError";
  }
}

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
