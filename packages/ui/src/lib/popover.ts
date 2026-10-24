export function supportsPopover(element: { showPopover?: unknown }) {
  return typeof element.showPopover === "function";
}
