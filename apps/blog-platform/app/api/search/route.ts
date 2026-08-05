import { createFromSource } from "fumadocs-core/search/server";

import { blog } from "@/lib/source";

/**
 * Backs the Ctrl+K dialog that `RootProvider search={...}` mounts in the root layout.
 * Without this route the default fetch client posts to `/api/search` and receives a
 * 404, which surfaces as a search dialog that silently returns nothing.
 *
 * `GET` (rather than `staticGET`) is the server-side handler the default client
 * expects, so enabling search needs no corresponding change in the provider.
 */
export const { GET } = createFromSource(blog);
