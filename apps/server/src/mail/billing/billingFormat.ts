/**
 * Money and dates for billing mail. Amounts arrive in the currency's minor unit (Dodo's
 * convention); the currency's own decimal places decide the divisor, so a JPY or KWD amount is
 * not printed as if it had cents.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    const format = new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return `${format.format(amountMinor / 10 ** digits)} ${code}`;
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${code}`;
  }
}

/** "26 October 2026", in UTC so the date does not depend on the server's zone. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Two-column summary table; labels and values must already be escaped. */
export function summaryTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="font-size:13px;color:#8f8c85;padding:4px 0;vertical-align:top;">${label}</td>
        <td style="font-size:13px;color:#171717;font-weight:600;text-align:right;padding:4px 0;">${value}</td>
      </tr>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px auto;max-width:440px;background-color:#faf9f5;border:1px solid rgba(23, 23, 23, 0.06);border-radius:12px;padding:24px;">${cells}
    </table>`;
}
