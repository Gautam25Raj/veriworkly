"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";

/**
 * The OpenAPI renderer used by generated API-reference pages.
 *
 * Since fumadocs-openapi v11 this is a pure client component: it no longer takes the server
 * instance. The schema is handed to it at render time through the `preloaded` prop, which
 * `app/api-reference/[[...slug]]/page.tsx` builds with `openapi.preloadOpenAPIPage(page)`.
 */
export const OpenAPIPage = createOpenAPIPage();

/** @deprecated v10 name — kept so any hand-written MDX using `<APIPage />` keeps working. */
export const APIPage = OpenAPIPage;
