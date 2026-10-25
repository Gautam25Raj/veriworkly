import { z } from "zod";

export const checkoutSchema = z.object({
  productKey: z.enum(["ai_credits", "portfolio_pro", "bundle"]).default("portfolio_pro"),
  interval: z.enum(["one_day", "seven_day", "monthly", "annual"]),
  redirectUrl: z
    .string()
    .trim()
    .regex(/^\/(?!\/)/, "Redirect URL must be a relative path")
    .optional(),
});

export const creditPackCheckoutSchema = z.object({
  packKey: z.enum(["credit_pack_250", "credit_pack_500"]),
  redirectUrl: z
    .string()
    .trim()
    .regex(/^\/(?!\/)/)
    .optional(),
});

export const dodoWebhookHeaderSchema = z.object({
  "webhook-id": z.string().trim().min(1, "Webhook ID is required"),
});

export const dodoSubscriptionSchema = z.object({
  subscription_id: z.string().trim().min(1, "Subscription ID is required"),
  customer: z.object({
    customer_id: z.string().trim().min(1, "Customer ID is required"),
  }),
  product_id: z.string().trim().min(1, "Product ID is required"),
  status: z.string().trim().min(1, "Status is required"),
  cancel_at_next_billing_date: z.boolean(),
  next_billing_date: z.string().trim().nullable().optional(),
  metadata: z
    .object({
      veriworkly_user_id: z.string().trim().optional(),
      veriworkly_product: z.string().trim().optional(),
      veriworkly_interval: z.string().trim().optional(),
    })
    .catchall(z.any())
    .default({}),
});

export const dodoWebhookEventSchema = z.object({
  type: z.string().trim().min(1, "Event type is required"),
  timestamp: z.string().trim().datetime("Invalid event timestamp"),
  data: z.unknown(),
});

/**
 * Only the fields the webhook handler reads are typed; everything else Dodo sends passes through
 * untouched (the whole event is stored as the audit payload). `total_amount` and
 * `is_update_payment_method` decide whether a payment earns the renewal credit allowance: a
 * card-update charge is a zero-amount `payment.succeeded` and must not mint credits (V-141).
 */
export const dodoPaymentSchema = z
  .object({
    payment_id: z.string().trim().min(1),
    subscription_id: z.string().trim().nullable().optional(),
    product_id: z.string().trim().nullable().optional(),
    product_cart: z
      .array(z.object({ product_id: z.string().trim().min(1) }).passthrough())
      .nullable()
      .optional(),
    total_amount: z.number().int().nonnegative().optional(),
    settlement_amount: z.number().int().nonnegative(),
    settlement_currency: z.string().trim().min(1),
    settlement_tax: z.number().int().nonnegative().nullable().optional(),
    tax: z.number().int().nonnegative().nullable().optional(),
    currency: z.string().trim().min(1).optional(),
    is_update_payment_method: z.boolean().optional().default(false),
    service_periods: z
      .array(
        z
          .object({
            subscription_id: z.string().trim().min(1),
            starts_at: z.string().trim().min(1),
            ends_at: z.string().trim().min(1),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
    metadata: z.record(z.string()).default({}),
  })
  .passthrough();
