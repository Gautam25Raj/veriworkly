import { randomUUID } from "node:crypto";

import { DEFAULT_POLICY } from "@veriworkly/ats-engine";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ACTION_KEYS } from "#services/aiTypes";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

/**
 * V-192: a client whose response was lost retries with the same requestId. Once the server has
 * committed, the retry gets the stored result back (the draft the user paid for) instead of a
 * 409, and is never charged again. A different request under the same id is still refused.
 */

const { completionCreate } = vi.hoisted(() => ({ completionCreate: vi.fn() }));

// `AiService.generate` talks to the provider through the OpenAI SDK client; the ATS paths below
// go through the global `fetch`, stubbed per test.
vi.mock("#services/aiClient", () => ({
  createAiClient: () => ({ chat: { completions: { create: completionCreate } } }),
}));

const { app } = await import("#app");
const { config } = await import("#config");
const { prisma } = await import("#lib/prisma");
const { applyRetention, readRetentionSettings } = await import("#jobs/retentionJob");
const { CreditService } = await import("#services/creditService");

const GENERATE_CREDITS = 3;
const CONVERSION_CREDITS = 25;
const ANALYSIS_CREDITS = 5;

const MODE = { credits: GENERATE_CREDITS, model: "generate-model", maxOutputTokens: 500 };
const AI_ACTIONS_POLICY = Object.fromEntries(
  AI_ACTION_KEYS.map((action) => [
    action,
    {
      maxTextChars: 4000,
      maxContextChars: 4000,
      maxJobDescriptionChars: 4000,
      systemPrompt: "system",
      userPromptTemplate: "{{text}} {{context}}",
      standard: MODE,
      expert: { ...MODE, credits: GENERATE_CREDITS * 2 },
    },
  ]),
);

const ATS_AI_POLICY = {
  prompts: { standardAnalysis: "analyse", onlineAnalysis: "analyse online", resumeConversion: "c" },
  pricing: { creditRevenueUsd: 1, analysisBuckets: [ANALYSIS_CREDITS], onlineMultiplier: 2 },
  models: [
    {
      model: "analysis-model",
      tiers: ["standard", "detailed", "advanced", "expert"],
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
      maxOutputTokens: 1000,
      retries: 0,
      feeMultiplier: 1,
    },
  ],
  resumeConversion: {
    credits: CONVERSION_CREDITS,
    model: "conversion-model",
    maxOutputTokens: 4000,
  },
};

const RESUME = [
  "Jane Doe",
  "jane@example.com",
  "Experience",
  "Staff Engineer, Example Corp, 2019 - Present",
  "Led the platform team and shipped the queue migration.",
  "Skills",
  "Postgres, TypeScript",
].join("\n");

const CONVERTED = {
  basics: { fullName: "Jane Doe", role: "", headline: "", email: "", phone: "", location: "" },
  links: [],
  summary: "",
  experience: [],
  education: [],
  projects: [],
  skills: [],
};

const ANALYSIS_REPLY = {
  explanation: "Targeted review",
  missingEvidence: [],
  keywordOpportunities: [],
  recommendedImprovements: [],
  priorityOrder: [],
};

function chatResponse(content: unknown) {
  const body = {
    id: `cmpl-${randomUUID()}`,
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function post(user: TestUser, path: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/v1${path}`)
    .set("Origin", STUDIO_ORIGIN)
    .set("Cookie", user.cookie)
    .send(body);
}

async function grantCredits(userId: string, amount: number) {
  const id = randomUUID();
  await CreditService.grant(userId, amount, {
    requestId: `grant:${id}`,
    source: "integration",
    sourceId: id,
  });
}

async function wallet(userId: string) {
  return prisma.creditWallet.findUniqueOrThrow({
    where: { userId },
    select: { balance: true, reserved: true },
  });
}

async function debits(userId: string) {
  return prisma.creditTransaction.count({ where: { userId, type: "DEBIT" } });
}

const fetchMock = vi.fn();
const originalAiConfig = { ...config.ai };

beforeAll(() => {
  config.ai.apiKey = "integration-test-key";
  config.ai.baseUrl = "https://provider.invalid/v1";
  config.ai.actionsPolicyJson = JSON.stringify(AI_ACTIONS_POLICY);
  config.ai.atsAiPolicyJson = JSON.stringify(ATS_AI_POLICY);
  config.ai.atsEnginePolicyJson = JSON.stringify(DEFAULT_POLICY);
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
  Object.assign(config.ai, originalAiConfig);
});

beforeEach(() => {
  fetchMock.mockReset();
  completionCreate.mockReset();
});

describe("V-192 AI generate: a retry after a lost response gets the paid draft back", () => {
  const body = (requestId: string, text = "Rewrite this line about queues.") => ({
    action: "rewrite_section",
    mode: "standard",
    input: { text },
    requestId,
  });

  it("returns the same draft with 200, calls the provider once and charges once", async () => {
    const user = await createUserWithSession();
    await grantCredits(user.id, 20);
    completionCreate.mockResolvedValue({
      id: "cmpl-generate",
      choices: [{ message: { content: "The rewritten line." } }],
      usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
    });
    const requestId = `gen-${randomUUID()}`;

    const first = await post(user, "/ai/generate", body(requestId));
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const afterFirst = await wallet(user.id);
    expect(afterFirst).toEqual({ balance: 20 - GENERATE_CREDITS, reserved: 0 });

    // The client never saw `first` and retries with the same id.
    const retry = await post(user, "/ai/generate", body(requestId));

    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.content).toBe("The rewritten line.");
    expect(retry.body.data.content).toBe(first.body.data.content);
    expect(retry.body.data.credits).toEqual(first.body.data.credits);
    expect(retry.body.data.replayed).toBe(true);
    expect(completionCreate).toHaveBeenCalledTimes(1);
    expect(await wallet(user.id)).toEqual(afterFirst);
    expect(await debits(user.id)).toBe(1);
  });

  it("still refuses the id for a different request, and charges nothing for it", async () => {
    const user = await createUserWithSession();
    await grantCredits(user.id, 20);
    completionCreate.mockResolvedValue({
      id: "cmpl-generate",
      choices: [{ message: { content: "The rewritten line." } }],
    });
    const requestId = `gen-${randomUUID()}`;
    expect((await post(user, "/ai/generate", body(requestId))).status).toBe(200);

    const other = await post(user, "/ai/generate", body(requestId, "A different line."));

    expect(other.status).toBe(409);
    expect(other.body.message).toBe("AI request id was already used for another operation.");
    expect(completionCreate).toHaveBeenCalledTimes(1);
    expect(await debits(user.id)).toBe(1);
  });

  it("answers 409 once the retention job has cleared the stored draft", async () => {
    const user = await createUserWithSession();
    await grantCredits(user.id, 20);
    completionCreate.mockResolvedValue({
      id: "cmpl-generate",
      choices: [{ message: { content: "The rewritten line." } }],
    });
    const requestId = `gen-${randomUUID()}`;
    expect((await post(user, "/ai/generate", body(requestId))).status).toBe(200);

    const settings = Object.fromEntries(
      Object.keys(readRetentionSettings({})).map((key) => [key, 0]),
    ) as ReturnType<typeof readRetentionSettings>;
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const summary = await applyRetention({
      settings: { ...settings, creditReplays: 1 },
      now: later,
    });
    expect(summary.affected.creditReplays).toBeGreaterThanOrEqual(1);

    const retry = await post(user, "/ai/generate", body(requestId));
    expect(retry.status).toBe(409);
    expect(await debits(user.id)).toBe(1);
  });
});

describe("V-192 ATS: conversion and analysis replays", () => {
  it("returns the stored conversion for a retried requestId without a second charge", async () => {
    const user = await createUserWithSession();
    await grantCredits(user.id, 100);
    fetchMock.mockResolvedValue(chatResponse(CONVERTED));
    const requestId = `conv-${randomUUID()}`;

    const first = await post(user, "/ats/convert-resume", { resume: RESUME, requestId });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const afterFirst = await wallet(user.id);
    expect(afterFirst).toEqual({ balance: 100 - CONVERSION_CREDITS, reserved: 0 });

    const retry = await post(user, "/ats/convert-resume", { resume: RESUME, requestId });

    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.resume).toEqual(first.body.data.resume);
    expect(retry.body.data.creditsSpent).toBe(CONVERSION_CREDITS);
    expect(retry.body.data.replayed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await wallet(user.id)).toEqual(afterFirst);
  });

  it("returns the stored analysis for a retried requestId without a second charge or scan", async () => {
    const user = await createUserWithSession();
    await grantCredits(user.id, 100);
    fetchMock.mockResolvedValue(chatResponse(ANALYSIS_REPLY));
    const analyzeBody = {
      resume: RESUME,
      requestId: `req-${randomUUID()}`,
      jobDescription: "We need a staff engineer who has run platform teams and shipped migrations.",
      fetchJobUrl: false,
    };

    const first = await post(user, "/ats/analyze", analyzeBody);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.data.aiStatus).toBe("ok");
    const afterFirst = await wallet(user.id);
    expect(afterFirst).toEqual({ balance: 100 - ANALYSIS_CREDITS, reserved: 0 });
    const scansUsed = first.body.data.quota.used;

    const retry = await post(user, "/ats/analyze", analyzeBody);

    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.ai).toEqual(first.body.data.ai);
    expect(retry.body.data.report).toEqual(first.body.data.report);
    expect(retry.body.data.replayed).toBe(true);
    expect(retry.body.data.quota.used).toBe(scansUsed);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await wallet(user.id)).toEqual(afterFirst);

    const other = await post(user, "/ats/analyze", { ...analyzeBody, jobDescription: "Other." });
    expect(other.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
