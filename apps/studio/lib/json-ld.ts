/**
 * Serialises structured data for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` leaves `<`, `>` and `&` as they are, so a value containing `</script>`
 * would close the tag early. Escaping them as unicode keeps the JSON identical to a parser.
 */
export function toSafeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
