import { fetchApiData } from "@/utils/fetchApiData";
import type { AtsCheckResult, AtsLayoutSignals, AtsQuota } from "../types";

export function runAtsCheck(input: {
  resume: unknown;
  jobDescription?: string;
  layout?: AtsLayoutSignals;
  file?: { name: string; bytes: number };
}) {
  return fetchApiData<AtsCheckResult>("/ats/check", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAtsQuota() {
  return fetchApiData<AtsQuota>("/ats/quota");
}

/** The server's upload limit (apps/server/src/routes/ats.ts, multer fileSize). */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function extractResumeFile(file: File) {
  const body = new FormData();
  body.append("resume", file);

  const data = await fetchApiData<{ text: string; layout?: AtsLayoutSignals; quota?: AtsQuota }>(
    "/ats/extract",
    { method: "POST", body, timeoutMs: 30_000 },
  );

  /** `layout` goes back with the scan so format checks see the real layout; without it those checks are skipped, not passed. */
  return data;
}
