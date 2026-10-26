/**
 * Stands in for the account of a row whose user was deleted (V-183: billing and affiliate money
 * rows are kept, detached). The studio's admin tables read `row.user.id` / `row.affiliate.id` and
 * the email unguarded, so a detached row carries this instead of `null`; `deleted: true` is how a
 * client tells it apart.
 */
export const DELETED_ACCOUNT_USER = {
  id: "deleted",
  name: null,
  email: "Deleted account",
  image: null,
  deleted: true,
} as const;

/** `row.user`, or the placeholder when the account was deleted. */
export function withAccountPlaceholder<T extends { user: unknown }>(row: T) {
  return { ...row, user: row.user ?? DELETED_ACCOUNT_USER };
}

/** `row.affiliate`, or the placeholder when the affiliate's account was deleted. */
export function withAffiliatePlaceholder<T extends { affiliate: unknown }>(row: T) {
  return { ...row, affiliate: row.affiliate ?? DELETED_ACCOUNT_USER };
}
