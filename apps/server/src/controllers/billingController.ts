import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import { requireAuthUser } from "#middleware/auth";
import { isProduction } from "#config";

import { BillingService } from "#services/billingService";
import { CreditService } from "#services/creditService";

import { ApiError, createSuccessResponse, handleValidationError } from "#lib/errors";
import { isAdminUser } from "#lib/isAdminUser";

import {
  checkoutSchema,
  creditPackCheckoutSchema,
  dodoWebhookHeaderSchema,
} from "#validators/billingValidator";

export class BillingController {
  // Blocked in production for everyone except the configured admin, who can still exercise
  // payments end-to-end for testing. Regular users only get payments in development/staging.
  private static assertPaymentsEnabled(user: { email: string | null }) {
    if (isProduction && !isAdminUser(user.email))
      throw new ApiError(
        403,
        "Payments are disabled in production during this phase. Only administrators can perform payments.",
      );
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(createSuccessResponse(await BillingService.getSummary(requireAuthUser(req).id)));
    } catch (error) {
      next(error);
    }
  }

  static async history(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(createSuccessResponse(await BillingService.getHistory(requireAuthUser(req).id)));
    } catch (error) {
      next(error);
    }
  }

  static async credits(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(createSuccessResponse(await CreditService.getWallet(requireAuthUser(req).id)));
    } catch (error) {
      next(error);
    }
  }

  static async creditHistory(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(createSuccessResponse(await CreditService.getHistory(requireAuthUser(req).id)));
    } catch (error) {
      next(error);
    }
  }

  static async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const input = checkoutSchema.parse(req.body);

      const user = requireAuthUser(req);
      BillingController.assertPaymentsEnabled(user);

      res.json(
        createSuccessResponse(
          await BillingService.createCheckout(
            user.id,
            input.productKey,
            input.interval,
            input.redirectUrl,
          ),
        ),
      );
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }

  static async cancelCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(createSuccessResponse(await BillingService.cancelCheckout(requireAuthUser(req).id)));
    } catch (error) {
      next(error);
    }
  }

  static async portal(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireAuthUser(req);
      BillingController.assertPaymentsEnabled(user);

      res.json(createSuccessResponse(await BillingService.createPortal(user.id)));
    } catch (error) {
      next(error);
    }
  }

  static async creditPackCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const input = creditPackCheckoutSchema.parse(req.body);

      const user = requireAuthUser(req);
      BillingController.assertPaymentsEnabled(user);

      res.json(
        createSuccessResponse(
          await BillingService.createCreditPackCheckout(user.id, input.packKey, input.redirectUrl),
        ),
      );
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }

  static async dodoWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

      if (!rawBody) throw new ApiError(400, "Webhook body is required.");

      const headers = Object.fromEntries(
        Object.entries(req.headers).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value]] : [],
        ),
      );

      const parsedHeaders = dodoWebhookHeaderSchema.parse(headers);
      const providerEventId = parsedHeaders["webhook-id"];

      const event = BillingService.unwrapWebhook(rawBody, headers);

      res.json(createSuccessResponse(await BillingService.processWebhook(providerEventId, event)));
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }
}
