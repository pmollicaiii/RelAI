/**
 * Inngest function registry.
 *
 * Live pipelines:
 *   - listing-embed     → hash-gated description embed (shared write path
 *                         with the local backfill: src/server/embeddings.ts)
 *
 * Scaffolds (real logic lands milestone by milestone):
 *   - source-extraction → Week 4 (5-pass chain via @relai/intent + @relai/inference)
 *   - packet-render     → Week 6 (composition via @relai/packet)
 *
 * Concurrency limits are set now so the shape is right before real load.
 */

import type { InngestFunction } from "inngest";

import { embedListingDescription } from "@/server/embeddings";
import {
  clientSourceIngested,
  inngest,
  listingEmbedRequested,
  packetRenderRequested,
} from "./client";

/**
 * Ongoing single-listing embed. The one-time corpus backfill runs as a
 * local script (pnpm --filter @relai/web embed:backfill); this function
 * handles event-driven re-embeds (re-sync, recipe bump, manual request).
 */
export const listingEmbed: InngestFunction.Any = inngest.createFunction(
  { id: "listing-embed", concurrency: 10, triggers: [listingEmbedRequested] },
  async ({ event, step }) => {
    const { listingId, reason } = event.data;
    const outcome = await step.run("embed-description", () => embedListingDescription(listingId));
    console.log(`[inngest:listing-embed] ${listingId} (${reason}) → ${outcome.status}`);
    return outcome;
  },
);

/** 5-pass extraction chain for a newly ingested client source. */
export const sourceExtraction: InngestFunction.Any = inngest.createFunction(
  { id: "source-extraction", concurrency: 5, triggers: [clientSourceIngested] },
  async ({ event, step }) => {
    const { folderId, sourceId } = event.data;
    await step.run("log-request", async () => {
      console.log(
        `[inngest:source-extraction] folder=${folderId} source=${sourceId} — scaffold, 5-pass chain lands Week 4`,
      );
      return { folderId, sourceId };
    });
    return { status: "scaffold", folderId, sourceId };
  },
);

/** Packet render: per-listing prose + Fair Housing gate. */
export const packetRender: InngestFunction.Any = inngest.createFunction(
  { id: "packet-render", concurrency: 5, triggers: [packetRenderRequested] },
  async ({ event, step }) => {
    const { packetId } = event.data;
    await step.run("log-request", async () => {
      console.log(`[inngest:packet-render] ${packetId} — scaffold, composition lands Week 6`);
      return { packetId };
    });
    return { status: "scaffold", packetId };
  },
);

export const functions: InngestFunction.Any[] = [listingEmbed, sourceExtraction, packetRender];
