import type { DocumentLinkItem } from "@/features/documents/core/link-types";

/**
 * Field rules shared by every document editor.
 *
 * The predicates live in `@veriworkly/profile-core`, which the server validates with too;
 * they are re-exported here as the one place to look for "how does this app validate a
 * field". What stays local belongs to the editors: the link-item check, which takes a
 * `DocumentLinkItem`, and the `ValidationErrors` shape the form components consume.
 */
export {
  isEmail,
  isHttpUrl,
  isMonthDate,
  isYearDate,
  isValidPhoneValue,
  VALIDATION_MESSAGES,
} from "@veriworkly/profile-core";

import { isHttpUrl, VALIDATION_MESSAGES } from "@veriworkly/profile-core";

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

/**
 * Link-item validation, shared by the resume and cover-letter link editors — both render
 * the same `LinksEditor`, and a malformed URL becomes a broken anchor in the HTML export
 * for either type.
 */
export function validateLinkItem(item: DocumentLinkItem): ValidationErrors<"label" | "url"> {
  const errors: ValidationErrors<"label" | "url"> = {};

  if (!isHttpUrl(item.url)) {
    errors.url = VALIDATION_MESSAGES.url;
  }

  return errors;
}
