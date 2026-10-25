import type { EntitlementKey } from "#services/productCatalog";

/**
 * Where each catalog entitlement is checked on the server (V-142). The catalog used to sell
 * `custom_subdomain` and `seo_controls` with nothing behind them: a free account got both.
 *
 * Every check declares itself here at module load, and uses the key this returns, so deleting
 * the check leaves an unused constant (lint) and an unregistered key: the product↔entitlement
 * contract test (`tests/billing/entitlement-contract.test.ts`) fails for any key the catalog
 * sells that no code enforces.
 */
const enforcementPoints = new Map<EntitlementKey, Set<string>>();

export function enforcedEntitlement<K extends EntitlementKey>(key: K, where: string): K {
  const points = enforcementPoints.get(key) ?? new Set<string>();
  points.add(where);
  enforcementPoints.set(key, points);
  return key;
}

export function entitlementEnforcementPoints(): ReadonlyMap<EntitlementKey, ReadonlySet<string>> {
  return enforcementPoints;
}
