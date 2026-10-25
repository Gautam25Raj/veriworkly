import { describe, expect, it } from "vitest";

import { idleInTransactionTimeoutOption, resolvePoolBudget } from "#lib/prisma";

/** V-115: the cluster-wide connection budget is enforced at boot in production. */
describe("resolvePoolBudget", () => {
  it("divides the budget across workers", () => {
    expect(
      resolvePoolBudget({ workers: 4, budget: 80, explicitPoolMax: undefined, production: true }),
    ).toMatchObject({ poolMax: 20, total: 80, overcommitted: false });
  });

  it("refuses to boot in production when the derived pool overcommits the budget", () => {
    // The floor of 2 per worker overcommits a budget of 10 across 8 workers.
    expect(() =>
      resolvePoolBudget({ workers: 8, budget: 10, explicitPoolMax: undefined, production: true }),
    ).toThrow(/DB_POOL_MAX_TOTAL/);
  });

  it("allows an explicit DB_POOL_MAX over budget (pooler case) and reports it", () => {
    expect(
      resolvePoolBudget({ workers: 4, budget: 80, explicitPoolMax: 50, production: true }),
    ).toMatchObject({ poolMax: 50, total: 200, overcommitted: true });
  });

  it("only warns outside production", () => {
    expect(
      resolvePoolBudget({ workers: 8, budget: 10, explicitPoolMax: undefined, production: false }),
    ).toMatchObject({ poolMax: 2, total: 16, overcommitted: true });
  });
});

/**
 * `idle_in_transaction_session_timeout` travels as a startup parameter, which a pooler such as
 * Neon's PgBouncer can refuse ("unsupported startup parameter"), failing every connection. It is
 * sent only when DB_IDLE_IN_TRANSACTION_TIMEOUT_MS is set.
 */
describe("idleInTransactionTimeoutOption", () => {
  it("sends nothing by default", () => {
    expect(idleInTransactionTimeoutOption({})).toEqual({});
    expect(idleInTransactionTimeoutOption({ DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: "" })).toEqual({});
  });

  it("sends the timeout when set explicitly", () => {
    expect(idleInTransactionTimeoutOption({ DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: "60000" })).toEqual({
      idle_in_transaction_session_timeout: 60_000,
    });
  });
});
