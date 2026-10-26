import { redirect } from "next/navigation";

/**
 * Keeps old `/admin/monetization` bookmarks working: they land on the affiliate program. Credits
 * and entitlements are under `/admin/billing`.
 */
export default function AdminMonetizationRedirectPage() {
  redirect("/admin/affiliates");
}
