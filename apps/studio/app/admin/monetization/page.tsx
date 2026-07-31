import { redirect } from "next/navigation";

/**
 * `/admin/monetization` was the single page that covered affiliates, credits, entitlements and
 * the audit log before those became their own sections. The bookmark is kept working by
 * redirecting to the affiliate program, which is what the page was mostly used for; credits and
 * entitlements now live under `/admin/billing`.
 */
export default function AdminMonetizationRedirectPage() {
  redirect("/admin/affiliates");
}
