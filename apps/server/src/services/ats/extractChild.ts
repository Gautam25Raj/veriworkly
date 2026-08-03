import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/**
 * Long-lived child process that performs the CPU-bound half of resume extraction.
 *
 * Runs as a separate OS process, not a worker thread. Worker threads share the parent's V8
 * process, and repeatedly spawning threads that load pdf.js segfaults Node (reproduced on
 * v24.18.0: a hard crash within 2-5 spawns, regardless of whether the thread was terminated or
 * allowed to exit on its own). A child process has its own heap, so both a crash and a forced
 * kill are contained.
 *
 * Deliberately imports nothing from `#lib/*` or `#config` — this process is spawned per server
 * worker and should not pull in dotenv/Redis/Prisma.
 *
 * Protocol: one `{ id, format, buffer }` request in, one `{ id, ok, ... }` response out. The `id`
 * lets the parent discard a late reply from a job it already timed out.
 */

export type AtsExtractFormat = "pdf" | "docx" | "text";

export type AtsExtractRequest = {
  id: number;
  format: AtsExtractFormat;
  buffer: string;
};

export type AtsExtractResponse =
  { id: number; ok: true; text: string } | { id: number; ok: false; message: string };

async function extract(format: AtsExtractFormat, data: Buffer): Promise<string> {
  if (format === "pdf") {
    const parser = new PDFParse({ data });

    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }

  if (format === "docx") return (await mammoth.extractRawText({ buffer: data })).value;

  return data.toString("utf8");
}

process.on("message", (request: AtsExtractRequest) => {
  void (async () => {
    try {
      const text = await extract(request.format, Buffer.from(request.buffer, "base64"));
      process.send?.({ id: request.id, ok: true, text } satisfies AtsExtractResponse);
    } catch (error) {
      process.send?.({
        id: request.id,
        ok: false,
        message: error instanceof Error ? error.message : "Resume extraction failed",
      } satisfies AtsExtractResponse);
    }
  })();
});

// Exit rather than linger if the parent goes away without killing us.
process.on("disconnect", () => process.exit(0));
