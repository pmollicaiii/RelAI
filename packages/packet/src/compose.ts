/**
 * Packet composition orchestrator.
 *
 * Given selected listings + the client profile, generate the per-listing
 * `hero_paragraph + matched_preferences + flags + suggested_photo_order`
 * blocks and run them through the Fair Housing gate.
 *
 * The actual LLM call is delegated to @relai/inference (router task:
 * 'packet_hero_prose'). This module orchestrates: per-listing parallel
 * calls, merge into packet block records, screen each block, propagate
 * hard-block to the packet level.
 */

import { infer } from "@relai/inference";
import type { InferenceTask } from "@relai/inference";

import {
  type FairHousingScreenResult,
  mergeScreenResults,
  screenWithKeywords,
} from "./fair-housing/index.js";

export interface ListingForPacket {
  id: string;
  facts: Record<string, unknown>;
  essenceMd: string;
  photoTags: string[];
}

export interface ComposeInput {
  clientProfileMd: string;
  listings: ListingForPacket[];
}

export interface ComposedBlock {
  listingId: string;
  heroParagraph: string;
  matchedPreferences: Array<{
    prefId: string;
    prefLabel: string;
    quote: string;
    evidence: string;
  }>;
  flags: string[];
  suggestedPhotoOrder: number[];
  model: string;
  fairHousing: FairHousingScreenResult;
}

export interface ComposedPacket {
  blocks: ComposedBlock[];
  fairHousing: FairHousingScreenResult;
  hardBlocked: boolean;
}

/**
 * Run packet composition for every selected listing in parallel.
 *
 * On `hardBlocked=true` the orchestrator returns the composed blocks but
 * the caller is expected to refuse to render. The blocks are kept so the
 * admin can review what tripped the gate.
 */
export async function composePacket(input: ComposeInput): Promise<ComposedPacket> {
  const tasks: InferenceTask[] = input.listings.map((l) => ({
    kind: "packet_hero_prose",
    clientProfileMd: input.clientProfileMd,
    listingFacts: l.facts,
    listingEssence: l.essenceMd,
    photoTags: l.photoTags,
  }));

  // Run packet prose generation in parallel via the inference router.
  const results = await Promise.all(tasks.map((t) => infer(t)));

  const blocks: ComposedBlock[] = [];
  for (let i = 0; i < input.listings.length; i++) {
    const listing = input.listings[i];
    const callResult = results[i];
    if (!listing || !callResult) continue;
    if (callResult.result.kind !== "packet_block") continue;

    const block = callResult.result;
    // Run Stage 1 (keyword) screen on the hero paragraph.
    const fh = screenWithKeywords(block.heroParagraph);

    blocks.push({
      listingId: listing.id,
      heroParagraph: block.heroParagraph,
      matchedPreferences: block.matchedPreferences,
      flags: block.flags,
      suggestedPhotoOrder: block.suggestedPhotoOrder,
      model: block.model,
      fairHousing: fh,
    });
  }

  // Aggregate Fair Housing across all blocks.
  const packetFh = mergeScreenResults(...blocks.map((b) => b.fairHousing));

  return {
    blocks,
    fairHousing: packetFh,
    hardBlocked: packetFh.hardBlocked,
  };
}
