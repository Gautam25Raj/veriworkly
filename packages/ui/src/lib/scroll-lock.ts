let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll(): () => void {
  const { body, documentElement } = document;

  if (lockCount++ === 0) {
    saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

    const widthBefore = documentElement.clientWidth;
    body.style.overflow = "hidden";
    const scrollbarWidth = documentElement.clientWidth - widthBefore;

    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      documentElement.style.setProperty("--scroll-lock-gap", `${scrollbarWidth}px`);
    }
  }

  return () => {
    if (--lockCount === 0 && saved) {
      body.style.overflow = saved.overflow;
      body.style.paddingRight = saved.paddingRight;
      documentElement.style.removeProperty("--scroll-lock-gap");
      saved = null;
    }
  };
}
