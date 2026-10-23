export function isActivePath(pathname: string | null, href: string) {
  if (!pathname || !href.startsWith("/")) return false;
  if (href === "/") return pathname === "/";

  const base = href.replace(/\/+$/, "");
  return pathname === base || pathname.startsWith(`${base}/`);
}
