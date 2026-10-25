import { beforeEach, describe, expect, it, vi } from "vitest";

const constructed: Array<Record<string, unknown>> = [];

vi.mock("openai", () => ({
  default: class OpenAI {
    constructor(options: Record<string, unknown>) {
      constructed.push(options);
    }
  },
}));

vi.mock("#config", () => ({
  config: {
    ai: {
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      timeoutMs: 120000,
      siteUrl: "",
    },
  },
}));

/**
 * The OpenAI SDK retries twice unless told otherwise. This client serves `AiService.generate`,
 * which makes one provider call per credit reservation, so SDK retries would be extra provider
 * calls nobody is charged for and nothing logs.
 */
describe("AI client retry configuration", () => {
  beforeEach(() => {
    constructed.length = 0;
    vi.resetModules();
  });

  it("disables SDK-level retries", async () => {
    const { createAiClient } = await import("#services/aiClient");
    createAiClient();

    expect(constructed).toHaveLength(1);
    expect(constructed[0]!.maxRetries).toBe(0);
  });
});
