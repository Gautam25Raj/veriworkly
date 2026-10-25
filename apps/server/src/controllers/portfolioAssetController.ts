import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import { requireAuthUser } from "#middleware/auth";

import { PortfolioAssetService } from "#services/portfolioAssetService";

import { createSuccessResponse, handleValidationError } from "#lib/errors";

import {
  portfolioAssetCompleteSchema,
  portfolioAssetUploadSchema,
} from "#validators/portfolioAssetValidator";

export class PortfolioAssetController {
  static async uploadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        createSuccessResponse(
          await PortfolioAssetService.createUploadUrl(
            requireAuthUser(req).id,
            portfolioAssetUploadSchema.parse(req.body),
          ),
        ),
      );
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }

  static async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const input = portfolioAssetCompleteSchema.parse(req.body);

      res.json(
        createSuccessResponse(
          await PortfolioAssetService.complete(
            requireAuthUser(req).id,
            input.assetId,
            input.checksum,
          ),
        ),
      );
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await PortfolioAssetService.delete(requireAuthUser(req).id, req.params.id);

      res.json(createSuccessResponse(null));
    } catch (error) {
      next(error);
    }
  }
}
