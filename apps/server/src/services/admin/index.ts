/**
 * Barrel for the admin service layer. Controllers import from here so the admin domain has a
 * single documented entry point, and so a service can be split into files without touching
 * every call site.
 */

export * as AdminOverviewService from "#services/admin/adminOverviewService";
export * as AdminUserService from "#services/admin/adminUserService";
export * as AdminAffiliateService from "#services/admin/adminAffiliateService";
export * as AdminAmbassadorService from "#services/admin/adminAmbassadorService";
export * as AdminPortfolioService from "#services/admin/adminPortfolioService";
export * as AdminDocumentService from "#services/admin/adminDocumentService";
export * as AdminBillingService from "#services/admin/adminBillingService";
export * as AdminAuditService from "#services/admin/adminAuditService";
export * as AdminApiKeyService from "#services/admin/adminApiKeyService";
export * as AdminSystemService from "#services/admin/adminSystemService";
