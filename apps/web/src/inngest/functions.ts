/**
 * Inngest function registry.
 *
 * V1 scaffolds: each function is a thin, step-structured shell that logs
 * and returns. Real pipeline logic lands milestone by milestone:
 *   - listing-embed     → Week 2 (corpus backfill runs locally; this handles ongoing re-embeds)
 *   - source-extraction → Week 4 (5-pass chain via @relai/intent + @relai/inference)
 *   - packet-render     → Week 6 (composition via @relai/packet)
 *
 * Concurrency limits are set now so the shape is right before real load.
 */

import type { InngestFunction } from "inngest";

import {
  clientSourceIngested,
  inngest,
  listingEmbedRequested,
  packetRenderRequested,
} from "./client";

/** Ongoing single-listing embed (corpus backfill runs as a local script instead). */
export const listingEmbed: InngestFunction.Any = inngest.createFunction(
  { id: "listing-embed", concurrency: 10, triggers: [listingEmbedRequested] },
  async ({ event, step }) => {
    const { listingId, reason } = event.data;
    await step.run("log-request", async () => {
      console.log(
        `[inngest:listing-embed] ${listingId} (${reason}) — scaffold, real embed lands Week 2`,
      );
      return { listingId, reason };
    });
    return { status: "scaffold", listingId };
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
