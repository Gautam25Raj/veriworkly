// Single source of truth for "is this user an admin" across the app (the
// workspace gate and the pricing/checkout gate). Deliberately fails closed:
// if ADMIN_EMAIL isn't configured, nobody is treated as an admin, rather than
// falling back to a hardcoded personal address.
export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !user?.email) return false;
  return user.email.trim().toLowerCase() === adminEmail;
}
