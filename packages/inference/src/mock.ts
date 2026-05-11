/**
 * Mock-mode inference handlers.
 *
 * When `INFERENCE_MODE=mock` (or no API keys are set), the router routes
 * every task to these handlers. They return deterministic stub outputs so
 * the app boots, pages render, and Inngest functions execute end-to-end
 * without external dependencies.
 *
 * **NEVER ship `INFERENCE_MODE=mock` to production.** The router asserts
 * `NODE_ENV !== 'production'` when mock mode is on (see `index.ts`).
 */

import { createHash } from "node:crypto";

import type {
  ClientMdResult,
  DiarizationResult,
  EmbeddingResult,
  EssenceDocResult,
  ExtractionResult,
  FairHousingResult,
  InferenceResult,
  InferenceTask,
  InferenceTaskKind,
  JudgmentResult,
  PacketBlockResult,
  PhotoTagsResult,
  SearchParseResult,
  SlugMappingResult,
  SmsCompressResult,
  TranscriptResult,
} from "./types.js";

const MOCK_MODEL_PREFIX = "mock/";

/**
 * Deterministic 1536-dim embedding generated from a sha256 hash so
 * cosines between identical inputs are 1 and different inputs are
 * roughly uniformly distributed.
 */
function mockEmbedding(text: string, dims: number = 3072): number[] {
  const hash = createHash("sha256").update(text).digest();
  const vec = new Array<number>(dims);
  for (let i = 0; i < dims; i++) {
    const byte = hash[i % hash.length] ?? 0;
    // Map byte (0-255) to a roughly-uniform [-1, 1] component.
    vec[i] = (byte - 127.5) / 127.5;
  }
  // Normalize so cosines are well-behaved.
  let sq = 0;
  for (const x of vec) sq += x * x;
  const norm = Math.sqrt(sq);
  if (norm === 0) return vec;
  return vec.map((x) => x / norm);
}

export function mockHandle(task: InferenceTask): InferenceResult {
  switch (task.kind) {
    case "embed_listing_description":
    case "embed_listing_essence":
    case "embed_soft_pref_statement":
    case "embed_search_query": {
      const result: EmbeddingResult = {
        kind: "embedding",
        vector: mockEmbedding(task.text, 3072),
        model: `${MOCK_MODEL_PREFIX}embedding`,
      };
      return result;
    }

    case "photo_embed": {
      const result: EmbeddingResult = {
        kind: "embedding",
        vector: mockEmbedding(`${task.listingId}:${task.sequence}`, 1024),
        model: `${MOCK_MODEL_PREFIX}photo-embedding`,
      };
      return result;
    }

    case "essence_doc_generate": {
      const result: EssenceDocResult = {
        kind: "essence_doc",
        essenceMd: `[mock essence] A representative listing characterization for ${task.listingId}. The home presents qualitative features typical of its tier and condition; finishes appear consistent with the era; likely fits a buyer seeking modest charm with practical livability.`,
        model: `${MOCK_MODEL_PREFIX}essence`,
      };
      return result;
    }

    case "photo_characterize": {
      const result: PhotoTagsResult = {
        kind: "photo_tags",
        roomType: "living-room",
        conditionSignals: ["good"],
        notableFeatures: ["hardwood-floors", "natural-light"],
        lighting: "daylight",
        model: `${MOCK_MODEL_PREFIX}photo-tags`,
      };
      return result;
    }

    case "transcribe_audio": {
      const result: TranscriptResult = {
        kind: "transcript",
        text: "[mock transcript] Buyer mentioned wanting a quiet home with a yard, near good schools, budget around eight hundred thousand.",
        durationSeconds: 30,
        model: `${MOCK_MODEL_PREFIX}transcribe`,
      };
      return result;
    }

    case "diarize_audio": {
      const result: DiarizationResult = {
        kind: "diarization",
        segments: [
          {
            speaker: "speaker_1",
            text: "What kind of place are you looking for?",
            startSec: 0,
            endSec: 3.2,
          },
          {
            speaker: "speaker_2",
            text: "Quiet, with a yard, near good schools. Budget around 800k.",
            startSec: 3.5,
            endSec: 9.1,
          },
        ],
        model: `${MOCK_MODEL_PREFIX}diarize`,
      };
      return result;
    }

    case "extract_parties": {
      const result: ExtractionResult = {
        kind: "extraction",
        pass: "parties",
        output: {
          parties: [{ name: null, role: "buyer", first_mentioned_at: null }],
        },
        model: `${MOCK_MODEL_PREFIX}extract`,
      };
      return result;
    }

    case "extract_hard_constraints": {
      const result: ExtractionResult = {
        kind: "extraction",
        pass: "hard_constraints",
        output: {
          hard_constraints: {
            budget_max: 800_000,
            beds_min: 3,
            baths_min: 2,
          },
        },
        model: `${MOCK_MODEL_PREFIX}extract`,
      };
      return result;
    }

    case "extract_soft_preferences": {
      const result: ExtractionResult = {
        kind: "extraction",
        pass: "soft_preferences",
        output: {
          soft_preferences: [
            {
              slug: "lifestyle-location.suburban-quiet",
              display_label: "quiet suburban",
              weight: 0.8,
              polarity: "positive",
              source_quote: task.transcript.slice(0, 120),
              source_timestamp: null,
              confidence: 0.8,
            },
          ],
        },
        model: `${MOCK_MODEL_PREFIX}extract`,
      };
      return result;
    }

    case "extract_contradictions": {
      const result: ExtractionResult = {
        kind: "extraction",
        pass: "contradictions",
        output: { contradictions: [] },
        model: `${MOCK_MODEL_PREFIX}extract`,
      };
      return result;
    }

    case "extract_gaps": {
      const result: ExtractionResult = {
        kind: "extraction",
        pass: "gaps",
        output: {
          gaps: [
            {
              topic: "commute",
              why_it_matters: "Where the household needs to commute drives location filter weight",
              suggested_question: "Where do the adults commute to on a typical day?",
            },
          ],
        },
        model: `${MOCK_MODEL_PREFIX}extract`,
      };
      return result;
    }

    case "curate_client_md": {
      const result: ClientMdResult = {
        kind: "client_md",
        contentMd: `# Client profile (mock)

## Hard constraints
- Budget under $800k
- 3+ bedrooms, 2+ baths

## Soft preferences
- Quiet suburban setting (0.8)

## Life context
- Looking for a family home; commute flexibility helpful

_Generated in mock mode. Real client.md will be richer once OPENAI_API_KEY / ANTHROPIC_API_KEY are set._`,
        model: `${MOCK_MODEL_PREFIX}client-md`,
      };
      return result;
    }

    case "parse_search_query": {
      const result: SearchParseResult = {
        kind: "search_parse",
        hardConstraints: {},
        softPreferences: [],
        model: `${MOCK_MODEL_PREFIX}parse-query`,
      };
      return result;
    }

    case "judge_listing_fit": {
      const result: JudgmentResult = {
        kind: "judgment",
        fitScore: 0.7,
        oneLineWhy: "Matches your stated preferences on layout and location.",
        flags: [],
        tiedPreferences: [],
        model: `${MOCK_MODEL_PREFIX}judge`,
      };
      return result;
    }

    case "map_soft_pref_to_ontology": {
      const result: SlugMappingResult = {
        kind: "slug_mapping",
        resolvedSlug: null,
        confidence: 0.5,
        proposeNew: true,
        model: `${MOCK_MODEL_PREFIX}slug-map`,
      };
      return result;
    }

    case "packet_hero_prose": {
      const result: PacketBlockResult = {
        kind: "packet_block",
        heroParagraph:
          "[mock packet prose] You mentioned wanting a quiet setting — this home sits on a low-traffic street with mature trees and a private backyard, exactly the kind of calm your conversations have circled.",
        matchedPreferences: [],
        flags: [],
        suggestedPhotoOrder: [0, 1, 2, 3, 4, 5],
        model: `${MOCK_MODEL_PREFIX}packet-prose`,
      };
      return result;
    }

    case "packet_sms_compress": {
      const result: SmsCompressResult = {
        kind: "sms_compress",
        text: "Found one you'll like — quiet street, fenced yard, in your range. Link in next msg.",
        model: `${MOCK_MODEL_PREFIX}sms`,
      };
      return result;
    }

    case "fair_housing_screen_outbound": {
      // Mock: scan for any banned word; flag if present.
      const banned = ["steer", "exclusive neighborhood", "good area for"];
      const flags: FairHousingResult["flags"] = [];
      const lower = task.text.toLowerCase();
      for (const phrase of banned) {
        if (lower.includes(phrase)) {
          flags.push({ phrase, category: "loaded_jargon", severity: "block" });
        }
      }
      const result: FairHousingResult = {
        kind: "fair_housing",
        flags,
        hardBlocked: flags.some((f) => f.severity === "block"),
        cleanedText: null,
        model: `${MOCK_MODEL_PREFIX}fair-housing`,
      };
      return result;
    }

    default: {
      // Should never happen — TypeScript exhaustiveness check.
      const _exhaustive: never = task;
      throw new Error(
        `mockHandle: unhandled task kind: ${(_exhaustive as { kind: InferenceTaskKind }).kind}`,
      );
    }
  }
}
