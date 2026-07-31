"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Select } from "@veriworkly/ui";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import {
  adjustAdminCredits,
  deleteAdminUser,
  grantAdminEntitlement,
  revokeAdminUserSessions,
  updateAdminUser,
} from "@/features/admin/services/admin-actions";

import type { AdminUserDetail, Role } from "@/features/admin/types/admin-types";

const ENTITLEMENT_KEYS = [
  "portfolio_publish",
  "ai_credits",
  "custom_subdomain",
  "seo_controls",
  "analytics",
  "watermark_removal",
];

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
  const [entitlementKey, setEntitlementKey] = useState(ENTITLEMENT_KEYS[0]);
  const [entitlementEndsAt, setEntitlementEndsAt] = useState("");
  const [error, setError] = useState("");

  const isProtectedAdmin = user.role === "ADMIN";

  return (
    <Card className="space-y-5 rounded-3xl p-6">
      <div>
        <h3 className="text-foreground font-semibold tracking-tight">Admin actions</h3>
        <p className="text-muted mt-1 text-xs leading-5">
          Each action records an audit entry against this account.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

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
            inputSize="sm"
            className="w-32"
            value={creditAmount}
            onChange={(event) => setCreditAmount(event.target.value)}
          />

          <AdminActionDialog
            trigger="Apply credits"
            disabled={!Number(creditAmount)}
            title="Adjust credit balance"
            description={`${Number(creditAmount) > 0 ? "Granting" : "Removing"} ${Math.abs(Number(creditAmount))} credits for ${user.email}.`}
            confirmLabel="Apply adjustment"
            onConfirm={async (reason) => {
              await adjustAdminCredits(user.id, Number(creditAmount), reason);
            }}
          />
        </div>
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
            onChange={(event) => setEntitlementKey(event.target.value)}
          >
            {ENTITLEMENT_KEYS.map((key) => (
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
          description={`${user._count.sessions} active session(s) will be deleted. The user will need to sign in again.`}
          confirmLabel="Revoke sessions"
          onConfirm={async (reason) => {
            await revokeAdminUserSessions(user.id, reason);
          }}
        />

        <AdminActionDialog
          trigger="Delete account"
          triggerVariant="secondary"
          triggerClassName="text-red-600"
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
          <p className="text-xs text-red-600">
            {isProtectedAdmin
              ? "Admin accounts cannot be deleted from this panel."
              : "There is no restore path for a deleted account."}
          </p>
        </AdminActionDialog>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setError("");
            router.refresh();
          }}
        >
          Refresh
        </Button>
      </div>
    </Card>
  );
};

export default UserAdminActions;
