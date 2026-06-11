/**
 * Inngest client + typed event definitions — the event bus for every
 * async pipeline.
 *
 * Event naming convention: `relai/<domain>.<action>` (past tense for facts,
 * `.requested` suffix for commands). Payloads carry IDs only — functions
 * re-read fresh DB state (same discipline as the archive's queue contract).
 *
 * Zod schemas validate at send + receive (zod ≥3.24 implements Standard
 * Schema, which Inngest v4 consumes natively).
 */

import { Inngest, eventType } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({ id: "relai" });

/** Command: embed (or re-embed) one listing's description. */
export const listingEmbedRequested = eventType("relai/listing.embed.requested", {
  schema: z.object({
    listingId: z.string().uuid(),
    reason: z.enum(["missing", "recipe-mismatch", "backfill"]),
  }),
});

/** Fact: an intake source landed; run the 5-pass extraction chain. */
export const clientSourceIngested = eventType("relai/client.source.ingested", {
  schema: z.object({
    folderId: z.string().uuid(),
    sourceId: z.string().uuid(),
  }),
});

/** Command: render a packet (blocks + compliance screen). */
export const packetRenderRequested = eventType("relai/packet.render.requested", {
  schema: z.object({
    packetId: z.string().uuid(),
  }),
});
