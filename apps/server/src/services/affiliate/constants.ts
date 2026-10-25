export const AFFILIATE_TIER_RATE_BPS = { TIER_1: 200, TIER_2: 300, TIER_3: 500 } as const;

export const AFFILIATE_DASHBOARD_TTL_SECONDS = 60;
export const AFFILIATE_LEADERBOARD_TTL_SECONDS = 300;
export const AFFILIATE_MINIMUM_WITHDRAWAL_CENTS = 2_500;

// Dodo settles the account in USD and `AffiliateWallet` holds USD cents. A commission recorded in
// any other currency is kept PENDING with its own currency until an admin converts it (V-017).
export const AFFILIATE_WALLET_CURRENCY = "USD";

/**
 * Days after sign-up during which a referral code can still be applied (V-016). Read from
 * `process.env` here rather than `#config` because the config module is owned elsewhere this
 * round; a missing, non-integer or non-positive value falls back to 30.
 */
export const AFFILIATE_ATTRIBUTION_DAYS = (() => {
  const parsed = Number.parseInt(process.env.AFFILIATE_ATTRIBUTION_DAYS ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 30;
})();

export const AFFILIATE_TIERS = [
  {
    key: "TIER_1",
    name: "Starter",
    rateBps: 200,
    requiredConversions: 0,
    perks: ["2% commission", "Monthly leaderboard access"],
  },
  {
    key: "TIER_2",
    name: "Growth",
    rateBps: 300,
    requiredConversions: 10,
    perks: ["3% commission", "Priority payout review"],
  },
  {
    key: "TIER_3",
    name: "Partner",
    rateBps: 500,
    requiredConversions: 50,
    perks: ["5% commission", "Priority support", "Partner campaigns"],
  },
] as const;
