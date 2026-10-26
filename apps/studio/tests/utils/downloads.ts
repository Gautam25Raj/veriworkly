import { vi } from "vitest";

export interface CapturedDownload {
  fileName: string;
  blob: Blob;
}

/**
 * Stands in for the browser pieces `downloadBlob` touches and records every file an
 * exporter hands to it, so a test reads exactly the bytes a user would save.
 *
 * Stubs `document` and `URL.createObjectURL`; the config's `unstubGlobals` puts them back.
 */
export function captureDownloads(): CapturedDownload[] {
  const downloads: CapturedDownload[] = [];
  const blobs = new Map<string, Blob>();

  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

  vi.stubGlobal("document", {
    body: { appendChild: () => undefined },
    createElement: () => {
      const link = { href: "", download: "", remove: () => undefined, click: () => undefined };

      link.click = () => {
        downloads.push({ fileName: link.download, blob: blobs.get(link.href)! });
      };

      return link;
    },
  });

  return downloads;
}
