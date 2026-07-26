import { config } from "#config";

// Single source of truth for "is this authenticated user the admin" used to let the admin bypass
// production-only gates (payments, publishing) for testing. Fails closed: if ADMIN_EMAIL isn't
// configured, nobody is treated as an admin.
export function isAdminUser(email: string | null | undefined): boolean {
  const adminEmail = config.admin.email;
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}
