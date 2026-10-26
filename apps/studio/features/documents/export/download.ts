/**
 * How long the object URL outlives the click. The browser reads it after `click()` returns,
 * and a large file can still be reading seconds later; revoking sooner truncates it.
 */
const REVOKE_AFTER_MS = 30_000;

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  // Some browsers only reliably fire a download from an anchor that's actually in
  // the document at click time.
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
