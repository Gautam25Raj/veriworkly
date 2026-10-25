import OpenAI from "openai";

import { createAiClient } from "#services/aiClient";
import { getAiActionPolicy, getAiModePolicy, publicAiActionPolicy } from "#services/aiPolicy";
import { aiTimeoutError } from "#services/ats/aiDeadline";
import { releaseReservationQuietly } from "#services/ats/atsAi";
import { CreditService } from "#services/creditService";

import { ApiError } from "#lib/errors";
import { logger } from "#lib/logger";

import type { AiGenerateInput } from "#validators/aiValidator";

function validateAndNormalizeInput(input: AiGenerateInput) {
  const policy = getAiActionPolicy(input.action);
  const text = (input.input.text ?? "").trim();
  const context = (input.input.context ?? "").trim();
  const jobDescription = (input.input.jobDescription ?? "")
    .trim()
    .slice(0, policy.maxJobDescriptionChars);
  const instructions = (input.input.instructions ?? "").trim();

  if (text.length > policy.maxTextChars)
    throw new ApiError(400, `Text exceeds the ${policy.maxTextChars} character limit.`);
  if (context.length > policy.maxContextChars)
    throw new ApiError(400, `Context exceeds the ${policy.maxContextChars} character limit.`);
  if (!text && !context && !jobDescription)
    throw new ApiError(400, "Provide text, context, or a job description for this AI action.");

  return { text, context, jobDescription, instructions };
}

function renderTemplate(template: string, input: ReturnType<typeof validateAndNormalizeInput>) {
  return template.replace(
    /\{\{(text|context|jobDescription|instructions)\}\}/g,
    (_match, key: keyof typeof input) => input[key],
  );
}

// The OpenAI client holds a connection-pooling agent, so building one per request threw away
// keep-alive and paid a fresh TLS handshake on every generation. Config is read once at startup.
let aiClient: ReturnType<typeof createAiClient> | null = null;

function getAiClient() {
  aiClient ??= createAiClient();
  return aiClient;
}

export class AiService {
  static actions() {
    return publicAiActionPolicy();
  }

  static async generate(
    userId: string,
    input: AiGenerateInput,
    /** Ends the provider call when the client leaves or the request deadline passes (V-034). */
    signal?: AbortSignal,
  ) {
    const normalizedInput = validateAndNormalizeInput(input);
    const actionPolicy = getAiActionPolicy(input.action);
    const modePolicy = getAiModePolicy(input.action, input.mode);
    const reservation = await CreditService.reserveAction(
      userId,
      input.action,
      input.mode,
      input.requestId,
    );

    try {
      const completion = await getAiClient().chat.completions.create(
        {
          ...(modePolicy.providerOptions ?? {}),
          model: modePolicy.model,
          messages: [
            { role: "system", content: actionPolicy.systemPrompt },
            {
              role: "user",
              content: renderTemplate(actionPolicy.userPromptTemplate, normalizedInput),
            },
          ],
          temperature: modePolicy.temperature,
          top_p: modePolicy.topP,
          max_tokens: modePolicy.maxOutputTokens,
          stream: false,
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        { signal },
      );

      const content = completion.choices[0]?.message?.content?.trim();

      if (!content) throw new ApiError(502, "The AI provider returned an empty response.");

      const transaction = await CreditService.commitReservation(userId, input.requestId, {
        documentId: input.documentId,
        referenceId: completion.id,
        reason: `AI ${input.mode} action: ${input.action}`,
        metadata: {
          promptTokens: completion.usage?.prompt_tokens ?? null,
          completionTokens: completion.usage?.completion_tokens ?? null,
          totalTokens: completion.usage?.total_tokens ?? null,
          mode: input.mode,
        },
      });

      return {
        content,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : null,
        credits: {
          spent: reservation.cost,
          balance: transaction.balanceAfter,
        },
      };
    } catch (error) {
      await releaseReservationQuietly(userId, input.requestId, { action: input.action });
      if (error instanceof ApiError) throw error;

      // The SDK raises its own abort error once `signal` fires; the signal says why we are here.
      if (signal?.aborted) {
        logger.warn("AI generation aborted before the provider answered", {
          action: input.action,
          mode: input.mode,
          requestId: input.requestId,
          reason: signal.reason instanceof Error ? signal.reason.message : String(signal.reason),
        });
        throw aiTimeoutError();
      }

      logger.error("AI generation failed", {
        action: input.action,
        mode: input.mode,
        requestId: input.requestId,
        error: error instanceof Error ? error.message : "Unknown AI provider error",
      });

      throw new ApiError(502, "The AI provider could not complete the request.");
    }
  }
}
