let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll(): () => void {
  const { body, documentElement } = document;

  if (lockCount++ === 0) {
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  }

  return () => {
    if (--lockCount === 0 && saved) {
      body.style.overflow = saved.overflow;
      body.style.paddingRight = saved.paddingRight;
      saved = null;
    }
  };
}
