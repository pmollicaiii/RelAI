/**
 * Listing description embeddings — the shared write path.
 *
 * Used by BOTH:
 *   - the Inngest `listing-embed` function (ongoing re-embeds, event-driven)
 *   - the local backfill script (src/scripts/embed-backfill.ts)
 * so the hash-gate + upsert semantics can never drift between the two.
 *
 * Contract (CLAUDE.md §6.10): the embedding identity is
 * (listing_id, kind, model, recipe_version, photo_sequence). A listing is
 * re-embedded only when the freshly computed source-text hash differs from
 * the one stored on its embedding row. The source text is rebuilt from DB
 * columns through @relai/embedding's recipe — the same single source of
 * truth the ingest used to stamp listings.source_text_hash.
 */

import { and, db, eq, listingEmbeddings, listings, sql } from "@relai/db";
import { buildEmbeddingInputAndHash } from "@relai/embedding";
import { type EmbeddingResult, ROUTER, infer } from "@relai/inference";

const EMBED_KIND = "description" as const;
const EXPECTED_DIMS = 3072;

/** Vendor-prefixed model id — also the `model` column value on embedding rows. */
export const DESCRIPTION_EMBED_MODEL = ROUTER.embed_listing_description.modelPrimary;

export function recipeVersion(): string {
  return process.env["EMBEDDING_RECIPE_VERSION"] ?? "v1";
}

export type EmbedOutcome =
  | { status: "embedded"; listingId: string; tokensIn: number; costUsd: number }
  | { status: "unchanged"; listingId: string }
  | { status: "empty-source"; listingId: string }
  | { status: "not-found"; listingId: string };

type ListingRow = typeof listings.$inferSelect;

/** Rebuild the recipe input from a listings row (mirror of ingest-lease). */
function sourceFromRow(row: ListingRow): Parameters<typeof buildEmbeddingInputAndHash>[0] {
  const tags = row.tagSets ?? {};
  return {
    publicRemarks: row.publicRemarks,
    architecturalStyleSlug: row.architecturalStyleSlug,
    conditionTier: row.conditionTier,
    propertyType: row.propertyType,
    interiorFeatures: tags.interior_features ?? [],
    exteriorFeatures: tags.exterior_features ?? [],
    exteriorMaterials: tags.exterior_materials ?? [],
    lotDescription: tags.lot_description ?? [],
    garageFeatures: tags.garage_features ?? [],
    fireplaceFeatures: tags.fireplace_features ?? [],
    kitchenAppliances: tags.kitchen_appliances ?? [],
    laundry: tags.laundry ?? [],
    otherStructures: tags.other_structures ?? [],
    yearBuilt: row.yearBuilt,
    subdivision: ((row.data as Record<string, unknown>)["subdivision"] as string | null) ?? null,
    mlsArea: row.mlsArea,
  };
}

/**
 * Embed one listing's description (hash-gated, idempotent).
 *
 * Pass `row` when the caller already holds the listings row (the backfill
 * does) to avoid a second SELECT per listing.
 */
export async function embedListingDescription(
  listingId: string,
  opts: { row?: ListingRow } = {},
): Promise<EmbedOutcome> {
  const row =
    opts.row ?? (await db.select().from(listings).where(eq(listings.id, listingId)).limit(1))[0];
  if (!row) return { status: "not-found", listingId };

  const { text, hash } = buildEmbeddingInputAndHash(sourceFromRow(row));
  if (text.trim().length === 0) return { status: "empty-source", listingId };

  const model = DESCRIPTION_EMBED_MODEL;
  const recipe = recipeVersion();

  const existing = await db
    .select({
      id: listingEmbeddings.id,
      sourceTextHash: listingEmbeddings.sourceTextHash,
      hasVector: sql<boolean>`(${listingEmbeddings.embedding} IS NOT NULL)`,
    })
    .from(listingEmbeddings)
    .where(
      and(
        eq(listingEmbeddings.listingId, listingId),
        eq(listingEmbeddings.kind, EMBED_KIND),
        eq(listingEmbeddings.model, model),
        eq(listingEmbeddings.recipeVersion, recipe),
      ),
    )
    .limit(1);

  if (existing[0] && existing[0].sourceTextHash === hash && existing[0].hasVector) {
    return { status: "unchanged", listingId };
  }

  const { result, meta } = await infer<EmbeddingResult>({
    kind: "embed_listing_description",
    text,
    listingId,
  });

  if (result.vector.length !== EXPECTED_DIMS) {
    throw new Error(
      `[embeddings] ${listingId}: expected ${EXPECTED_DIMS}-dim vector, got ${result.vector.length} from ${meta.modelUsed}`,
    );
  }

  await db
    .insert(listingEmbeddings)
    .values({
      listingId,
      kind: EMBED_KIND,
      model,
      recipeVersion: recipe,
      embedding: result.vector,
      sourceTextHash: hash,
      photoSequence: null,
    })
    .onConflictDoUpdate({
      target: [
        listingEmbeddings.listingId,
        listingEmbeddings.kind,
        listingEmbeddings.model,
        listingEmbeddings.recipeVersion,
        listingEmbeddings.photoSequence,
      ],
      set: {
        embedding: result.vector,
        sourceTextHash: hash,
        generatedAt: sql`now()`,
      },
    });

  return { status: "embedded", listingId, tokensIn: meta.tokensIn, costUsd: meta.costUsd };
}
