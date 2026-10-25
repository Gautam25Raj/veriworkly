import OpenAI from "openai";

import { config } from "#config";
import { ApiError } from "#lib/errors";

// One client per process: it holds a connection-pooling agent, so building one per request
// would throw away keep-alive and pay a fresh TLS handshake on every generation.
let client: OpenAI | null = null;

export function createAiClient() {
  if (client) return client;

  if (!config.ai.apiKey) {
    throw new ApiError(503, "AI provider credentials are not configured.");
  }

  client = new OpenAI({
    apiKey: config.ai.apiKey,
    baseURL: config.ai.baseUrl,
    timeout: config.ai.timeoutMs,
    /**
     * The SDK retries twice by default. This client serves only `AiService.generate`, which
     * makes one provider call per credit reservation; SDK retries would be billed by the
     * provider without being charged or logged, and would run the request past its deadline.
     * (The ATS AI path does not use this client: it calls the provider through the engine
     * package's fetch adapter and runs its own retry loop.) So the transport retries nothing.
     */
    maxRetries: 0,
    defaultHeaders: config.ai.siteUrl ? { "HTTP-Referer": config.ai.siteUrl } : undefined,
  });

  return client;
}
