/**
 * OpenAI vendor handlers.
 *
 * The client is created lazily on first use so a missing OPENAI_API_KEY
 * never crashes at import time — only at the call site that needs it
 * (and `shouldUseMock` in index.ts already mocks that path in dev).
 *
 * Wired today: embeddings (text-embedding-3-large powers all four
 * embed_* task kinds). Chat/transcription handlers land with their
 * milestones (Week 4+).
 */

import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "[@relai/inference] OPENAI_API_KEY is not set. The caller should have routed to mock mode — this is a dispatch bug, not a config gap.",
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** $ per 1M input tokens, by model. Source: openai.com/api/pricing. */
const EMBEDDING_PRICE_PER_M: Record<string, number> = {
  "text-embedding-3-large": 0.13,
  "text-embedding-3-small": 0.02,
};

export interface OpenAiEmbedResult {
  vectors: number[][];
  tokensIn: number;
  costUsd: number;
  /** Bare model name as OpenAI reports it (no vendor prefix). */
  model: string;
}

/**
 * Embed one or more texts. `model` accepts the router's vendor-prefixed
 * form ('openai/text-embedding-3-large') or the bare model name.
 *
 * OpenAI API errors carry `.status`, which `defaultIsRetriable` in
 * retry.ts reads — 429/5xx retry, other 4xx fail fast.
 */
export async function openaiEmbed(texts: string[], model: string): Promise<OpenAiEmbedResult> {
  const bareModel = model.includes("/") ? (model.split("/")[1] ?? model) : model;
  const response = await getClient().embeddings.create({
    model: bareModel,
    input: texts,
  });

  // The API returns data in input order, but sort by index defensively.
  const vectors = [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vectors.length !== texts.length) {
    throw new Error(
      `[@relai/inference] OpenAI returned ${vectors.length} embeddings for ${texts.length} inputs`,
    );
  }

  const tokensIn = response.usage?.prompt_tokens ?? 0;
  const pricePerM = EMBEDDING_PRICE_PER_M[bareModel] ?? 0;
  return {
    vectors,
    tokensIn,
    costUsd: (tokensIn / 1_000_000) * pricePerM,
    model: response.model ?? bareModel,
  };
}

/** Test seam: reset the lazy client (e.g. after mutating env in a test). */
export function resetOpenAiClient(): void {
  client = null;
}
