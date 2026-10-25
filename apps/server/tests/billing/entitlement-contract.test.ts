import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { entitlementEnforcementPoints } from "#services/entitlementEnforcement";
import { ENTITLEMENT_KEYS, productCatalog } from "#services/productCatalog";
import { ENTITLEMENT_KEYS as ADMIN_GRANTABLE_KEYS } from "#validators/admin/adminBillingValidator";
import { resolveSeo } from "#services/portfolioService";

/**
 * Product ↔ entitlement contract (V-142). The catalog once sold `custom_subdomain` and
 * `seo_controls` with no check behind either, so a free account got both. Every key the
 * catalog can grant must be enforced somewhere on the server, and an enforcement point
 * registers itself with `enforcedEntitlement`. The modules that do so are found by scanning
 * `src`, so a check added in a new file is picked up without editing this test.
 */
const SRC = path.resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [full] : [];
  });
}

const enforcingModules = sourceFiles(SRC).filter(
  (file) =>
    !file.endsWith(`${path.sep}entitlementEnforcement.ts`) &&
    readFileSync(file, "utf8").includes("enforcedEntitlement("),
);

beforeAll(async () => {
  for (const file of enforcingModules) await import(pathToFileURL(file).href);
});

describe("product ↔ entitlement contract", () => {
  it("finds the enforcing modules", () => {
    expect(enforcingModules.length).toBeGreaterThan(0);
  });

  it("every entitlement key has at least one server-side enforcement point", () => {
    const points = entitlementEnforcementPoints();
    const unenforced = Object.values(ENTITLEMENT_KEYS).filter((key) => !points.get(key)?.size);

    expect(unenforced).toEqual([]);
  });

  it("every entitlement a product grants is a known, enforced key", () => {
    const points = entitlementEnforcementPoints();
    const known = new Set<string>(Object.values(ENTITLEMENT_KEYS));

    for (const [product, entry] of Object.entries(productCatalog)) {
      for (const key of entry.entitlements) {
        expect(known.has(key), `${product} grants unknown ${key}`).toBe(true);
        expect(points.get(key)?.size ?? 0, `${product} grants unenforced ${key}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("admins can grant exactly the catalog's keys", () => {
    expect([...ADMIN_GRANTABLE_KEYS].sort()).toEqual(Object.values(ENTITLEMENT_KEYS).sort());
  });
});

describe("resolveSeo", () => {
  const requested = { title: "Custom", description: "Mine", socialImage: null };

  it("keeps the block for an account with seo_controls", () => {
    expect(resolveSeo(requested, true)).toBe(requested);
  });

  it("publishes the empty block without it", () => {
    expect(resolveSeo(requested, false)).toEqual({
      title: "",
      description: "",
      socialImage: null,
    });
  });
});
