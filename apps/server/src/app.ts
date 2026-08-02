import helmet from "helmet";
import compression from "compression";
import express, { raw, Request, Response, RequestHandler } from "express";

import { config } from "#config";

import { corsMiddleware } from "#middleware/cors";
import { loggingMiddleware } from "#middleware/logging";
import { rateLimitMiddleware } from "#middleware/rateLimit";
import { errorHandler, notFoundHandler } from "#middleware/errorHandler";
import { authRequestDiagnosticsMiddleware } from "#middleware/authRequestDiagnostics";

import aiRoutes from "#routes/ai";
import atsRoutes from "#routes/ats";
import userRoutes from "#routes/users";
import statsRoutes from "#routes/stats";
import githubRoutes from "#routes/github";
import healthRoutes from "#routes/health";
import sharesRoutes from "#routes/shares";
import apiKeyRoutes from "#routes/apiKeys";
import roadmapRoutes from "#routes/roadmap";
import changelogRoutes from "#routes/changelog";
import contactRoutes from "#routes/contact";
import billingRoutes from "#routes/billing";
import profileRoutes from "#routes/profiles";
import documentRoutes from "#routes/documents";
import portfolioRoutes from "#routes/portfolios";
import affiliateRoutes from "#routes/affiliates";
import ambassadorRoutes from "#routes/ambassador";
import portfolioAssetRoutes from "#routes/portfolioAssets";
import adminRoutes from "#routes/admin/index";
import { BillingController } from "#controllers/billingController";

import { getRequestIpDetails } from "#utils/requestIp";

import { authNodeHandler, authRequestContext } from "#auth/index";

const app = express();

// Security middleware
app.use(helmet());

// Compress JSON responses (resume/portfolio payloads can be large; free bandwidth/latency win)
app.use(compression());

// CORS middleware
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Logging middleware
app.use(loggingMiddleware);

// Body parser middleware
app.post(
  "/api/v1/billing/webhooks/dodo",
  raw({ type: "application/json", limit: "1mb" }),
  BillingController.dodoWebhook,
);

// JSON only, deliberately. `application/x-www-form-urlencoded` is one of the three CORS
// "simple" content types, so it is the only body format a cross-origin POST can send without
// triggering a preflight — mounting a parser for it would give away preflight as a structural
// CSRF barrier for no benefit, since no client sends that format (multipart uploads go through
// multer on the routes that accept them). SameSite=lax on the session cookie is the other layer.
app.use(express.json({ limit: "4mb" }));

// Trust proxy (for accurate IP addresses behind reverse proxies)
app.set("trust proxy", config.server.trustProxy);

// Versioned API routes
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/ats", atsRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/stats", statsRoutes);
app.use("/api/v1/github", githubRoutes);
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/shares", sharesRoutes);
app.use("/api/v1/roadmap", roadmapRoutes);
app.use("/api/v1/changelog", changelogRoutes);
app.use("/api/v1/api-keys", apiKeyRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/profiles", profileRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/portfolios", portfolioRoutes);
app.use("/api/v1/affiliates", affiliateRoutes);
app.use("/api/v1/ambassador", ambassadorRoutes);
app.use("/api/v1/portfolio-assets", portfolioAssetRoutes);

// Single admin surface. Auth is enforced once inside the router, so every sub-route added
// under `#routes/admin` is gated by construction.
app.use("/api/v1/admin", adminRoutes);

app.all(["/api/v1/auth", "/api/v1/auth/*"], [
  authRequestDiagnosticsMiddleware,
  (req: Request, res: Response) => {
    let provider: string | undefined = undefined;
    const cleanPath = req.path.replace(/\/+$/, "");

    if (cleanPath.includes("/callback/")) provider = cleanPath.split("/").pop();
    else if (cleanPath.includes("verify-otp") || cleanPath.includes("email-otp"))
      provider = "email-otp";

    const ipDetails = getRequestIpDetails(req);
    authRequestContext.run(
      {
        ip: ipDetails.resolvedIp,
        userAgent: req.headers["user-agent"] || "unknown",
        provider,
      },
      () => {
        authNodeHandler(req, res);
      },
    );
  },
] as RequestHandler[]);

// Root GET route
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "VeriWorkly API Server",
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export { app };
export default app;
