import { z } from "zod";

export const portfolioAssetUploadSchema = z.object({
  kind: z.enum(["AVATAR", "PROJECT_COVER", "SOCIAL_IMAGE"]),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const portfolioAssetCompleteSchema = z.object({
  assetId: z.string().min(1),
  checksum: z.string().max(256).optional(),
});
