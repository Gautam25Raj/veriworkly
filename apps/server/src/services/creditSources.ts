/**
 * Credit grant sources, in a module with no imports so any service (and any test that mocks
 * `creditService`) can use them.
 */

/** Where a credit grant came from (`CreditGrant.source`). */
export const CREDIT_SOURCES = {
  creditPack: "credit_pack",
  /** A subscription or pass payment's allowance (monthly plans, passes, legacy annual). */
  subscriptionPayment: "subscription_payment",
  /** An annual plan's monthly grant (owner decision 4, `annualCreditService`). */
  annualMonthly: "subscription_monthly",
  adminAdjustment: "admin_adjustment",
} as const;

/**
 * Credits somebody paid for. A wallet holding only these (no plan, no pass) belongs to a paying
 * "credits" customer; credits an admin granted as goodwill do not make anyone a paying customer
 * (V-188). Any "is this user paying" helper should count credits through this list.
 */
export const PAID_CREDIT_SOURCES: readonly string[] = [
  CREDIT_SOURCES.creditPack,
  CREDIT_SOURCES.subscriptionPayment,
  CREDIT_SOURCES.annualMonthly,
];
