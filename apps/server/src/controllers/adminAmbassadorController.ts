import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { requireAuthUser } from "#middleware/auth";
import { AmbassadorService } from "#services/ambassadorService";
import { prisma } from "#lib/prisma";
import { createSuccessResponse, handleValidationError } from "#lib/errors";
import {
  adminAmbassadorListQuerySchema,
  adminAmbassadorReviewSchema,
} from "#validators/ambassadorValidator";

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  reason: string | undefined,
) {
  await prisma.adminAuditEntry.create({
    data: { actorId, action, targetType: "AmbassadorApplication", targetId, reason },
  });
}

export class AdminAmbassadorController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = adminAmbassadorListQuerySchema.parse(req.query);
      res.json(createSuccessResponse(await AmbassadorService.listApplications(status)));
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }

  static async review(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = requireAuthUser(req);
      const input = adminAmbassadorReviewSchema.parse(req.body);
      const application = await AmbassadorService.reviewApplication(
        req.params.id,
        input.action,
        actor.id,
        input.reviewNote,
      );
      await audit(
        actor.id,
        `ambassador.application.${input.action.toLowerCase()}`,
        application.id,
        input.reviewNote,
      );
      res.json(createSuccessResponse(application));
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  }
}
