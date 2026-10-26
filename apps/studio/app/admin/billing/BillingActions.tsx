"use client";

import { useState } from "react";
import Link from "next/link";

import { Select } from "@veriworkly/ui";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import {
  ADMIN_ENTITLEMENT_KEYS,
  adjustAdminCredits,
  grantAdminEntitlement,
  replayAdminWebhook,
  revokeAdminEntitlement,
  updateAdminSubscription,
  type AdminEntitlementKey,
} from "@/features/admin/services/admin-actions";

import type { SubscriptionStatus } from "@/features/admin/types/admin-types";

import { parseCreditAmount } from "./credit-amount";

const inputClass =
  "border-border bg-background h-9 w-full rounded-lg border px-3 text-xs outline-none";

/**
 * Edits to our copy of a subscription.
 *
 * Neither control reaches the payment provider (Dodo), and neither grants or revokes access:
 * access follows entitlement grants, and the next provider webhook overwrites these fields. The
 * dialogs say so, because support reading "cancel" would otherwise believe billing stopped.
 */
export function SubscriptionActions({
  id,
  status,
  email,
  cancelAtPeriodEnd,
}: {
  id: string;
  status: SubscriptionStatus;
  email: string;
  cancelAtPeriodEnd: boolean;
}) {
  const [nextStatus, setNextStatus] = useState<SubscriptionStatus>(status);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        aria-label="Subscription status"
        className="h-8 w-32 text-xs"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value as SubscriptionStatus)}
      >
        <option value="ACTIVE">Active</option>
        <option value="PAST_DUE">Past due</option>
        <option value="CANCELED">Canceled</option>
        <option value="INACTIVE">Inactive</option>
      </Select>

      <AdminActionDialog
        trigger="Apply"
        disabled={nextStatus === status}
        title="Override subscription status"
        description={
          <>
            Changes the status label on {email}&apos;s subscription to {nextStatus}, nothing else:
            it does not grant or revoke access and does not touch billing at Dodo, and the next
            webhook overwrites it. To give or remove access, use the grant form on{" "}
            <Link href="/admin/billing/entitlements" className="text-accent underline">
              Entitlements
            </Link>
            .
          </>
        }
        confirmLabel="Change label"
        onConfirm={async (reason) => {
          await updateAdminSubscription(id, { status: nextStatus, reason });
        }}
      />

      <AdminActionDialog
        trigger={
          cancelAtPeriodEnd
            ? "Clear cancel-at-period-end (local flag only)"
            : "Mark cancel-at-period-end (local flag only — cancel in Dodo)"
        }
        title={
          cancelAtPeriodEnd
            ? "Clear the local cancel-at-period-end flag"
            : "Mark cancel-at-period-end (local flag only)"
        }
        description={
          cancelAtPeriodEnd
            ? `Clears the flag on our copy of ${email}'s subscription. Nothing changes at Dodo, and the next webhook overwrites the flag.`
            : `Sets a flag on our copy of ${email}'s subscription only. It does not cancel anything at Dodo: the renewal still charges until the subscription is cancelled in the Dodo dashboard, and the next webhook overwrites this flag.`
        }
        confirmLabel="Save flag"
        onConfirm={async (reason) => {
          await updateAdminSubscription(id, { cancelAtPeriodEnd: !cancelAtPeriodEnd, reason });
        }}
      />
    </div>
  );
}

/** Grant or claw back credits for one account, by user id. */
export function CreditAdjustmentForm() {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("100");

  const parsed = parseCreditAmount(amount);
  const ready = userId.trim().length > 0 && parsed.ok;

  return (
    <div className="space-y-3">
      <input
        className={inputClass}
        placeholder="User id"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      />

      <input
        className={inputClass}
        type="number"
        step={1}
        placeholder="Credits (negative to claw back)"
        aria-invalid={!parsed.ok}
        aria-describedby={parsed.ok ? undefined : "credit-adjustment-error"}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

      {!parsed.ok && (
        <p id="credit-adjustment-error" role="alert" className="text-xs text-red-600">
          {parsed.message}
        </p>
      )}

      <AdminActionDialog
        trigger="Apply adjustment"
        triggerVariant="primary"
        disabled={!ready}
        title="Adjust a credit balance"
        description={
          parsed.ok
            ? `${parsed.amount > 0 ? "Granting" : "Removing"} ${Math.abs(parsed.amount)} credits.`
            : parsed.message
        }
        confirmLabel="Apply"
        onConfirm={async (reason, attemptKey) => {
          if (!parsed.ok) throw new Error(parsed.message);
          await adjustAdminCredits(userId.trim(), parsed.amount, reason, attemptKey);
          setUserId("");
        }}
      />
    </div>
  );
}

/** Manual entitlement grant, optionally time-boxed. */
export function EntitlementGrantForm() {
  const [userId, setUserId] = useState("");
  const [key, setKey] = useState<AdminEntitlementKey>(ADMIN_ENTITLEMENT_KEYS[0]);
  const [endsAt, setEndsAt] = useState("");

  return (
    <div className="space-y-3">
      <input
        className={inputClass}
        placeholder="User id"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      />

      <Select
        className="h-9 text-xs"
        value={key}
        onChange={(event) => setKey(event.target.value as AdminEntitlementKey)}
      >
        {ADMIN_ENTITLEMENT_KEYS.map((entitlement) => (
          <option key={entitlement} value={entitlement}>
            {entitlement.replace(/_/g, " ")}
          </option>
        ))}
      </Select>

      <input
        className={inputClass}
        type="date"
        aria-label="Expiry date (optional)"
        value={endsAt}
        onChange={(event) => setEndsAt(event.target.value)}
      />

      <AdminActionDialog
        trigger="Grant entitlement"
        triggerVariant="primary"
        disabled={!userId.trim()}
        title="Grant an entitlement"
        description={`Granting "${key}"${endsAt ? ` until ${endsAt}` : " with no expiry"}.`}
        confirmLabel="Grant"
        onConfirm={async (reason) => {
          await grantAdminEntitlement({
            userId: userId.trim(),
            key,
            endsAt: endsAt ? new Date(`${endsAt}T23:59:59.000Z`).toISOString() : null,
            reason,
          });

          setUserId("");
          setEndsAt("");
        }}
      />
    </div>
  );
}

export function EntitlementRevokeAction({
  id,
  entitlementKey,
  revoked,
}: {
  id: string;
  entitlementKey: string;
  revoked: boolean;
}) {
  if (revoked) return <span className="text-muted text-xs">Revoked</span>;

  return (
    <AdminActionDialog
      trigger="Revoke"
      triggerClassName="text-destructive"
      title="Revoke this entitlement"
      description={`Access to "${entitlementKey}" is removed immediately. Any feature gated on it stops working for this account.`}
      confirmLabel="Revoke"
      onConfirm={async (reason) => {
        await revokeAdminEntitlement(id, reason);
      }}
    />
  );
}

/**
 * Replays a stored provider event through the normal webhook pipeline. Already-processed
 * events are rejected server-side, so the control is only offered where a replay can help.
 */
export function WebhookReplayAction({ id, status }: { id: string; status: string }) {
  if (status === "PROCESSED") return <span className="text-muted text-xs">Done</span>;

  return (
    <AdminActionDialog
      trigger="Replay"
      title="Replay this webhook event"
      description="The stored provider payload is re-run through the same pipeline as a live delivery. Use this for an event that failed on a transient error."
      confirmLabel="Replay event"
      onConfirm={async (reason) => {
        await replayAdminWebhook(id, reason);
      }}
    />
  );
}
