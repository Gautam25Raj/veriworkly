/**
 * The server's rule for an admin audit reason: a required reason needs `minLength` characters,
 * and an optional one may be left blank but is rejected when it is shorter than that.
 */
export function isAdminReasonValid(
  reason: string,
  { required, minLength }: { required: boolean; minLength: number },
) {
  const length = reason.trim().length;

  return length >= minLength || (!required && length === 0);
}
