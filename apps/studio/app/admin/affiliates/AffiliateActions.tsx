"use client";

import { useState } from "react";

import { Select } from "@veriworkly/ui";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import {
  createAdminCommission,
  updateAdminAffiliate,
  updateAdminCommission,
  updateAdminWithdrawal,
} from "@/features/admin/services/admin-actions";
import { formatCents } from "@/features/admin/utils/admin-format";

import type { AffiliateStatus, AffiliateTier } from "@/features/admin/types/admin-types";

/** Standing (status) and commission tier for a single affiliate. */
export function AffiliateStandingActions({
  userId,
  status,
  tier,
  email,
}: {
  userId: string;
  status: AffiliateStatus;
  tier: AffiliateTier;
  email: string;
}) {
  const [nextStatus, setNextStatus] = useState(status);
  const [nextTier, setNextTier] = useState(tier);

  const dirty = nextStatus !== status || nextTier !== tier;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Affiliate status"
        className="h-8 w-32 text-xs"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value as AffiliateStatus)}
      >
        <option value="ACTIVE">Active</option>
        <option value="PENDING">Pending</option>
        <option value="SUSPENDED">Suspended</option>
      </Select>

      <Select
        aria-label="Affiliate tier"
        className="h-8 w-28 text-xs"
        value={nextTier}
        onChange={(event) => setNextTier(event.target.value as AffiliateTier)}
      >
        <option value="TIER_1">Tier 1</option>
        <option value="TIER_2">Tier 2</option>
        <option value="TIER_3">Tier 3</option>
      </Select>

      <AdminActionDialog
        trigger="Save"
        disabled={!dirty}
        title="Update affiliate standing"
        description={`${email} → status ${nextStatus}, tier ${nextTier}. Suspending stops new commissions accruing.`}
        confirmLabel="Save changes"
        reasonRequired={false}
        onConfirm={async (reason) => {
          await updateAdminAffiliate(userId, {
            ...(nextStatus !== status
              ? { status: nextStatus as "PENDING" | "ACTIVE" | "SUSPENDED" }
              : {}),
            ...(nextTier !== tier ? { tier: nextTier } : {}),
            reason: reason || undefined,
          });
        }}
      />
    </div>
  );
}

/** Release or reverse a pending commission. Non-pending rows are terminal server-side. */
export function CommissionActions({
  id,
  status,
  amountCents,
}: {
  id: string;
  status: string;
  amountCents: number;
}) {
  if (status !== "PENDING") return <span className="text-muted text-xs">No action</span>;

  return (
    <div className="flex flex-wrap gap-2">
      <AdminActionDialog
        trigger="Release"
        triggerVariant="primary"
        title="Release this commission"
        description={`${formatCents(amountCents)} moves from the affiliate's pending balance to available, making it withdrawable.`}
        confirmLabel="Release commission"
        reasonRequired={false}
        onConfirm={async (reason) => {
          await updateAdminCommission(id, "AVAILABLE", reason || undefined);
        }}
      />

      <AdminActionDialog
        trigger="Reverse"
        title="Reverse this commission"
        description={`${formatCents(amountCents)} is removed from the affiliate's pending balance. Use this when the underlying payment was refunded or fraudulent.`}
        confirmLabel="Reverse commission"
        onConfirm={async (reason) => {
          await updateAdminCommission(id, "REVERSED", reason);
        }}
      />
    </div>
  );
}

/**
 * Withdrawal decisions.
 *
 * Payouts leave the platform out of band (the payment provider has no third-party transfer
 * API), so "Mark paid" records a transfer a human already made — it does not move money.
 */
export function WithdrawalActions({
  id,
  status,
  amountCents,
  email,
}: {
  id: string;
  status: string;
  amountCents: number;
  email: string;
}) {
  if (status === "REQUESTED") {
    return (
      <div className="flex flex-wrap gap-2">
        <AdminActionDialog
          trigger="Approve"
          triggerVariant="primary"
          title="Approve this withdrawal"
          description={`Approving ${formatCents(amountCents)} for ${email}. The funds stay reserved until you mark the payout as paid.`}
          confirmLabel="Approve"
          reasonLabel="Payout note"
          reasonRequired={false}
          onConfirm={async (reason) => {
            await updateAdminWithdrawal(id, "APPROVED", reason || undefined);
          }}
        />

        <AdminActionDialog
          trigger="Reject"
          title="Reject this withdrawal"
          description={`${formatCents(amountCents)} is returned to ${email}'s available balance.`}
          confirmLabel="Reject"
          reasonLabel="Payout note"
          onConfirm={async (reason) => {
            await updateAdminWithdrawal(id, "REJECTED", reason);
          }}
        />
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <AdminActionDialog
        trigger="Mark paid"
        triggerVariant="primary"
        title="Record this payout as paid"
        description={`Confirm that ${formatCents(amountCents)} has actually been sent to ${email}. This records the transfer; it does not send money.`}
        confirmLabel="Mark as paid"
        reasonLabel="Payout reference"
        reasonPlaceholder="Bank reference, PayPal transaction id, etc."
        onConfirm={async (reason) => {
          await updateAdminWithdrawal(id, "PAID", reason);
        }}
      />
    );
  }

  return <span className="text-muted text-xs">Finalized</span>;
}

/** Manual commission entry for a payment that never produced a webhook. */
export function CommissionCreateForm() {
  const [referredUserId, setReferredUserId] = useState("");
  const [providerPaymentId, setProviderPaymentId] = useState("");
  const [amountUsd, setAmountUsd] = useState("");

  const purchaseAmountCents = Math.round(Number(amountUsd || 0) * 100);
  const ready = referredUserId.trim() && providerPaymentId.trim() && purchaseAmountCents > 0;

  const inputClass =
    "border-border bg-background h-9 w-full rounded-lg border px-3 text-xs outline-none";

  return (
    <div className="space-y-3">
      <input
        className={inputClass}
        placeholder="Referred user id"
        value={referredUserId}
        onChange={(event) => setReferredUserId(event.target.value)}
      />

      <input
        className={inputClass}
        placeholder="Provider payment id"
        value={providerPaymentId}
        onChange={(event) => setProviderPaymentId(event.target.value)}
      />

      <input
        className={inputClass}
        type="number"
        min="0"
        step="0.01"
        placeholder="Purchase amount (USD)"
        value={amountUsd}
        onChange={(event) => setAmountUsd(event.target.value)}
      />

      <p className="text-muted text-xs">
        The commission itself is derived from the affiliate&apos;s tier rate — enter the
        customer&apos;s purchase amount, not the payout.
      </p>

      <AdminActionDialog
        trigger="Create commission"
        triggerVariant="primary"
        disabled={!ready}
        title="Create a manual commission"
        description={`Recording a ${formatCents(purchaseAmountCents)} purchase against the referring affiliate. The commission amount is calculated from their tier.`}
        confirmLabel="Create commission"
        reasonRequired={false}
        onConfirm={async (reason) => {
          await createAdminCommission({
            referredUserId: referredUserId.trim(),
            providerPaymentId: providerPaymentId.trim(),
            purchaseAmountCents,
            status: "AVAILABLE",
            reason: reason || undefined,
          });

          setReferredUserId("");
          setProviderPaymentId("");
          setAmountUsd("");
        }}
      />
    </div>
  );
}
