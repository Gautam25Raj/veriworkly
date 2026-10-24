import { createHmac, randomUUID } from "node:crypto";

import { config } from "#config";

/**
 * Standard Webhooks signature, the format the Dodo SDK verifies: `v1,base64(HMAC-SHA256(key,
 * "{id}.{unix-seconds}.{body}"))` where `key` is the base64 payload after the `whsec_` prefix.
 */
export function signDodoWebhook(
  body: string,
  options: { id?: string; timestamp?: Date; secret?: string } = {},
): Record<string, string> {
  const secret = options.secret ?? config.dodo.webhookSecret;
  const keyBase64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(keyBase64, "base64");

  const id = options.id ?? `msg_${randomUUID()}`;
  const seconds = Math.floor((options.timestamp ?? new Date()).getTime() / 1000);
  const signature = createHmac("sha256", key).update(`${id}.${seconds}.${body}`).digest("base64");

  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": String(seconds),
    "webhook-signature": `v1,${signature}`,
  };
}
