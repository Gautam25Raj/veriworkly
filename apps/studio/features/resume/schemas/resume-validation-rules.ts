/*
 * The resume's field rules: predicates and zod primitives from `@veriworkly/profile-core`,
 * which the server imports too, so the two sides cannot drift.
 *
 * `phoneSchema` accepts empty: an incomplete profile must still be storable, and blocking a
 * save on a blank optional field is a UI concern, not a storage one.
 */
export {
  isHttpUrl,
  isMonthDate,
  isYearDate,
  isValidPhoneValue,
  normalizePhoneValue,
  isLegacyUnqualifiedPhone,
  phoneSchema,
  emailOrEmptySchema,
  urlOrEmptySchema,
  monthDateSchema,
  yearDateSchema,
} from "@veriworkly/profile-core";
