import type { Instrumentation } from "next";

/** Forwards server errors to ERROR_REPORT_URL (else one stderr line); request headers are left out because they carry cookies. */

const REPORT_URL = process.env.ERROR_REPORT_URL;

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;

  const report = {
    at: new Date().toISOString(),
    app: "site",
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    digest,
    // No query string: it can carry search terms or referral codes.
    path: request.path.split("?")[0],
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  };

  if (!REPORT_URL) {
    console.error("[request-error]", JSON.stringify(report));
    return;
  }

  try {
    await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (cause) {
    console.error("[request-error] report failed:", cause, JSON.stringify(report));
  }
};
