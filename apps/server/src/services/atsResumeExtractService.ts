import { ApiError } from "#lib/errors";
import { logger } from "#lib/logger";

import { extractInChildProcess } from "#services/atsExtractPool";
import type { AtsExtractFormat } from "#services/atsExtractChild";

const MAX_TEXT_CHARS = 50_000;

function detectFormat(file: Express.Multer.File): AtsExtractFormat {
  const name = file.originalname.toLowerCase();

  if (file.mimetype === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";

  if (file.mimetype.startsWith("text/") || /\.(txt|md|json)$/i.test(name)) return "text";

  throw new ApiError(400, "Upload a PDF, DOCX, TXT, Markdown, or JSON resume.");
}

function normalize(text: string) {
  const value = text
    .replace(/\0/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (value.length < 50)
    throw new ApiError(400, "Resume file did not contain enough readable text.");

  return value.slice(0, MAX_TEXT_CHARS);
}

export class AtsResumeExtractService {
  /**
   * Parses in a separate process so a pathological file cannot stall the event loop.
   *
   * The previous implementation raced the parse against a timer on the main thread: the caller
   * got a tidy 408, but pdf-parse kept chewing CPU with no way to stop it, so one crafted upload
   * could stall every concurrent request on the process. The extraction process can actually be
   * killed, which is what makes the timeout mean something.
   */
  static async extract(file: Express.Multer.File) {
    const format = detectFormat(file);

    // Plain text needs no parser, so it skips the IPC round trip entirely.
    if (format === "text") return normalize(file.buffer.toString("utf8"));

    try {
      return normalize(await extractInChildProcess(format, file.buffer));
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error("Resume extraction failed", {
        format,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ApiError(400, "Resume file could not be read.");
    }
  }
}
