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

  // Revoke on the next tick rather than synchronously — revoking immediately after
  // click() is a known source of flaky/truncated downloads for larger blobs in some
  // browsers, since the download may not have finished reading the object URL yet.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
