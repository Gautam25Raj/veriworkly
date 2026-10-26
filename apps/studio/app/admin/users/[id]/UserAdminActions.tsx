"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Select } from "@veriworkly/ui";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import Panel from "@/components/admin/Panel";
import {
  ADMIN_ENTITLEMENT_KEYS,
  adjustAdminCredits,
  deleteAdminUser,
  grantAdminEntitlement,
  revokeAdminUserSessions,
  updateAdminUser,
  type AdminEntitlementKey,
} from "@/features/admin/services/admin-actions";

import type { AdminUserDetail, Role } from "@/features/admin/types/admin-types";

import { parseCreditAmount } from "@/app/admin/billing/credit-amount";
import { pluralize } from "@/lib/pluralize";

/**
 * Every control on this panel writes to the admin audit log, so each one is wrapped in the
 * shared confirmation dialog rather than firing on a bare click. The role select is the one
 * exception to "no local state": it needs a staged value before the dialog opens.
 */
const UserAdminActions = ({ detail }: { detail: AdminUserDetail }) => {
  const router = useRouter();
  const { user } = detail;

  const [role, setRole] = useState<Role>(user.role);
  const [creditAmount, setCreditAmount] = useState("100");
  const [entitlementKey, setEntitlementKey] = useState<AdminEntitlementKey>(
    ADMIN_ENTITLEMENT_KEYS[0],
  );
  const [entitlementEndsAt, setEntitlementEndsAt] = useState("");

  const credits = parseCreditAmount(creditAmount);

  const isProtectedAdmin = user.role === "ADMIN";
  // Deleting the account here cancels nothing at the payment provider.
  const hasLiveSubscription = detail.subscriptions.some(
    (subscription) => subscription.status === "ACTIVE" || subscription.status === "PAST_DUE",
  );

  return (
    <Panel className="space-y-5 rounded-xl p-4">
      <div>
        <h3 className="text-foreground font-semibold tracking-tight">Admin actions</h3>
        <p className="text-muted mt-1 text-xs leading-5">
          Each action records an audit entry against this account.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-user-role" className="text-muted text-xs font-medium">
          Role
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            id="admin-user-role"
            className="h-9 w-40 text-xs"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="USER">User</option>
            <option value="AMBASSADOR">Ambassador</option>
            <option value="ADMIN">Admin</option>
          </Select>

          <AdminActionDialog
            trigger="Save role"
            disabled={role === user.role}
            title="Change this user's role"
            description={`Moving ${user.email} from ${user.role} to ${role}. All of their sessions will be revoked so the new role takes effect immediately.`}
            confirmLabel="Change role"
            onConfirm={async (reason) => {
              await updateAdminUser(user.id, { role, reason });
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-user-credits" className="text-muted text-xs font-medium">
          Credit adjustment (negative claws back)
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="admin-user-credits"
            type="number"
            step={1}
            inputSize="sm"
            className="w-32"
            aria-invalid={!credits.ok}
            aria-describedby={credits.ok ? undefined : "admin-user-credits-error"}
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
          />

          <AdminActionDialog
            trigger="Apply credits"
            disabled={!credits.ok}
            title="Adjust credit balance"
            description={
              credits.ok
                ? `${credits.amount > 0 ? "Granting" : "Removing"} ${Math.abs(credits.amount)} credits for ${user.email}.`
                : credits.message
            }
            confirmLabel="Apply adjustment"
            onConfirm={async (reason, attemptKey) => {
              if (!credits.ok) throw new Error(credits.message);
              await adjustAdminCredits(user.id, credits.amount, reason, attemptKey);
            }}
          />
        </div>

        {!credits.ok && (
          <p id="admin-user-credits-error" role="alert" className="text-xs text-red-600">
            {credits.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-user-entitlement" className="text-muted text-xs font-medium">
          Grant entitlement
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            id="admin-user-entitlement"
            className="h-9 w-44 text-xs"
            value={entitlementKey}
            onChange={(event) => setEntitlementKey(event.target.value as AdminEntitlementKey)}
          >
            {ADMIN_ENTITLEMENT_KEYS.map((key) => (
              <option key={key} value={key}>
                {key.replace(/_/g, " ")}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            inputSize="sm"
            className="w-40"
            aria-label="Entitlement end date (optional)"
            value={entitlementEndsAt}
            onChange={(event) => setEntitlementEndsAt(event.target.value)}
          />

          <AdminActionDialog
            trigger="Grant"
            title="Grant an entitlement"
            description={`Granting "${entitlementKey}" to ${user.email}${entitlementEndsAt ? ` until ${entitlementEndsAt}` : " with no expiry"}.`}
            confirmLabel="Grant entitlement"
            onConfirm={async (reason) => {
              await grantAdminEntitlement({
                userId: user.id,
                key: entitlementKey,
                // The API takes a full ISO timestamp; a date input yields a bare date.
                endsAt: entitlementEndsAt
                  ? new Date(`${entitlementEndsAt}T23:59:59.000Z`).toISOString()
                  : null,
                reason,
              });
            }}
          />
        </div>
      </div>

      <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-4">
        <AdminActionDialog
          trigger="Revoke all sessions"
          title="Sign this user out everywhere"
          description={`${pluralize(user._count.sessions, "active session")} will be deleted. The user will need to sign in again.`}
          confirmLabel="Revoke sessions"
          onConfirm={async (reason) => {
            await revokeAdminUserSessions(user.id, reason);
          }}
        />

        <AdminActionDialog
          trigger="Delete account"
          triggerVariant="secondary"
          triggerClassName="text-destructive"
          disabled={isProtectedAdmin}
          title="Permanently delete this account"
          description="This cannot be undone. Documents, portfolios, share links, wallets, and API keys are all deleted with the account."
          confirmLabel="Delete permanently"
          confirmPhrase={user.email}
          confirmPhraseLabel={`Type ${user.email} to confirm`}
          onConfirm={async (reason) => {
            await deleteAdminUser(user.id, user.email, reason);
            router.push("/admin/users");
          }}
        >
          <p className="text-destructive text-xs">
            {isProtectedAdmin
              ? "Admin accounts cannot be deleted from this panel."
              : "There is no restore path for a deleted account."}
          </p>

          {hasLiveSubscription ? (
            <p className="text-warning text-xs">
              This account has a live subscription. Deleting it here does not cancel anything at
              Dodo, so the card keeps being charged: cancel the subscription in the Dodo dashboard
              first.
            </p>
          ) : null}
        </AdminActionDialog>

        <Button size="sm" variant="ghost" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>
    </Panel>
  );
};

export default UserAdminActions;
