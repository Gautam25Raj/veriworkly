import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { ApiError } from "#lib/errors";

const MAX_TEXT_CHARS = 50_000;
const EXTRACTION_TIMEOUT_MS = 20_000;

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

/**
 * Bounds how long an unauthenticated caller can tie up the request with a single upload.
 * pdf-parse/mammoth run synchronously on the event loop with no cancellation hook, so this
 * doesn't reclaim CPU already spent on a pathological file — it only stops the request from
 * hanging indefinitely and gives the client a clear error instead of a dropped connection.
 */
async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError(408, `Resume ${label} took too long to process.`)),
      EXTRACTION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export class AtsResumeExtractService {
  static async extract(file: Express.Multer.File) {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: file.buffer });
      try {
        return normalize((await withTimeout(parser.getText(), "extraction")).text);
      } finally {
        await parser.destroy();
      }
    }

    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx")
    ) {
      return normalize(
        (await withTimeout(mammoth.extractRawText({ buffer: file.buffer }), "extraction")).value,
      );
    }

    if (file.mimetype.startsWith("text/") || /\.(txt|md|json)$/i.test(file.originalname)) {
      return normalize(file.buffer.toString("utf8"));
    }

    throw new ApiError(400, "Upload a PDF, DOCX, TXT, Markdown, or JSON resume.");
  }
}
