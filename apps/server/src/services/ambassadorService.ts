import { ApiError } from "#lib/errors";
import { prisma } from "#lib/prisma";
import type { AmbassadorApplicationInput } from "#validators/ambassadorValidator";

export class AmbassadorService {
  static async apply(userId: string, input: AmbassadorApplicationInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, ambassadorStatus: true, ambassadorApplication: { select: { status: true } } },
    });

    if (!user) throw new ApiError(404, "User not found.");
    if (user.role === "AMBASSADOR")
      throw new ApiError(400, "You are already a campus ambassador.");
    if (user.ambassadorApplication?.status === "PENDING")
      throw new ApiError(400, "Your ambassador application is already pending review.");

    const [application] = await prisma.$transaction([
      prisma.ambassadorApplication.upsert({
        where: { userId },
        create: { userId, ...input },
        update: {
          ...input,
          status: "PENDING",
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      }),
      prisma.user.update({ where: { id: userId }, data: { ambassadorStatus: "PENDING" } }),
    ]);

    return {
      success: true,
      ambassadorStatus: application.status,
      collegeName: application.collegeName,
      graduationYear: application.graduationYear,
    };
  }

  static async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        ambassadorStatus: true,
        ambassadorApplication: {
          select: { collegeName: true, graduationYear: true, status: true },
        },
      },
    });
    if (!user) throw new ApiError(404, "User not found.");

    return {
      role: user.role,
      ambassadorStatus: user.ambassadorStatus,
      collegeName: user.ambassadorApplication?.collegeName ?? null,
      graduationYear: user.ambassadorApplication?.graduationYear ?? null,
    };
  }

  static async listApplications(status?: "PENDING" | "APPROVED" | "REJECTED") {
    return prisma.ambassadorApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
  }

  static async reviewApplication(
    applicationId: string,
    action: "APPROVE" | "REJECT",
    reviewerId: string,
    reviewNote?: string,
  ) {
    const application = await prisma.ambassadorApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new ApiError(404, "Ambassador application not found.");
    if (application.status !== "PENDING")
      throw new ApiError(400, "This application has already been reviewed.");

    const status = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const [updatedApplication] = await prisma.$transaction([
      prisma.ambassadorApplication.update({
        where: { id: applicationId },
        data: { status, reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote },
      }),
      prisma.user.update({
        where: { id: application.userId },
        data: {
          ambassadorStatus: status,
          role: action === "APPROVE" ? "AMBASSADOR" : "USER",
        },
      }),
    ]);

    return updatedApplication;
  }
}
