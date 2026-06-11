/**
 * Lease-corpus ingest — Week 2 milestone, scoped to Residential Lease.
 *
 * Reads the 9 `*Residential Lease.csv` files from seed-data/mls/, maps each
 * row to a CanonicalListing, computes the source_text_hash via the
 * @relai/embedding recipe (single source of truth), and upserts into Neon
 * in batches.
 *
 * Embeddings are NOT generated here — that's the embed backfill script,
 * which needs OPENAI_API_KEY. The hash stored now is exactly what gates
 * that backfill (and every future re-sync).
 *
 * Run: pnpm --filter @relai/db ingest:lease
 * Idempotent: ON CONFLICT (mls_number, source) DO UPDATE.
 */

import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { buildEmbeddingInputAndHash } from "@relai/embedding";
import { type CanonicalListing, mapBrightRecord, parseBrightCsv } from "@relai/mls-adapter";
import { sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { listings } from "./schema";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];
if (!url) {
  console.error("[ingest:lease] DATABASE_URL must be set");
  process.exit(1);
}

const SEED_DIR = path.resolve(import.meta.dirname, "../../../seed-data/mls");
const BATCH_SIZE = 50;

function computeHash(l: CanonicalListing): string {
  const { hash } = buildEmbeddingInputAndHash({
    publicRemarks: l.publicRemarks,
    architecturalStyleSlug: l.architecturalStyleSlug,
    conditionTier: l.conditionTier,
    propertyType: l.propertyType,
    interiorFeatures: l.tagSets.interior_features,
    exteriorFeatures: l.tagSets.exterior_features,
    exteriorMaterials: l.tagSets.exterior_materials,
    lotDescription: l.tagSets.lot_description,
    garageFeatures: l.tagSets.garage_features,
    fireplaceFeatures: l.tagSets.fireplace_features,
    kitchenAppliances: l.tagSets.kitchen_appliances,
    laundry: l.tagSets.laundry,
    otherStructures: l.tagSets.other_structures,
    yearBuilt: l.yearBuilt,
    subdivision: (l.data["subdivision"] as string | null) ?? null,
    mlsArea: l.mlsArea,
  });
  return hash;
}

function toRow(l: CanonicalListing): typeof listings.$inferInsert {
  return {
    mlsNumber: l.mlsNumber,
    source: l.source,
    sourceTextHash: l.sourceTextHash,
    transactionMode: l.transactionMode,
    listingStatus: l.listingStatus,
    price: l.price?.toString() ?? null,
    originalPrice: l.originalPrice?.toString() ?? null,
    soldPrice: l.soldPrice?.toString() ?? null,
    beds: l.beds,
    bathsFull: l.bathsFull,
    bathsPartial: l.bathsPartial,
    sqftAbove: l.sqftAbove,
    sqftBelow: l.sqftBelow,
    sqftInterior: l.sqftInterior,
    acres: l.acres?.toString() ?? null,
    lotSqft: l.lotSqft,
    yearBuilt: l.yearBuilt,
    age: l.age,
    dom: l.dom,
    garageSpaces: l.garageSpaces,
    fireplaceCount: l.fireplaceCount,
    roomCount: l.roomCount,
    stories: l.stories,
    floorNumber: l.floorNumber,
    taxesAnnual: l.taxesAnnual?.toString() ?? null,
    assessment: l.assessment?.toString() ?? null,
    hoaFee: l.hoaFee?.toString() ?? null,
    hoaFeeFrequency: l.hoaFeeFrequency,
    architecturalStyleSlug: l.architecturalStyleSlug,
    propertyType: l.propertyType,
    conditionTier: l.conditionTier,
    utilitySystems: l.utilitySystems,
    tagSets: l.tagSets,
    publicRemarks: l.publicRemarks,
    city: l.city,
    state: l.state,
    zip: l.zip,
    lat: l.lat?.toString() ?? null,
    lng: l.lng?.toString() ?? null,
    mlsArea: l.mlsArea,
    township: l.township,
    county: l.county,
    data: l.data,
  };
}

async function main(): Promise<void> {
  if (!url) throw new Error("unreachable");
  const db = drizzle(neon(url));

  const files = (await readdir(SEED_DIR)).filter((f) => /Residential Lease\.csv$/i.test(f));
  console.log(`[ingest:lease] ${files.length} lease CSV file(s) in ${SEED_DIR}`);
  if (files.length === 0) {
    console.error("[ingest:lease] No lease CSVs found — check seed-data/mls/");
    process.exit(1);
  }

  let totalParsed = 0;
  let totalSkipped = 0;
  let totalUpserted = 0;

  for (const file of files) {
    const content = await readFile(path.join(SEED_DIR, file), "utf8");
    const { records, errors } = parseBrightCsv(content);
    if (errors.length > 0) {
      console.warn(`[ingest:lease] ${file}: ${errors.length} parse warnings (continuing)`);
    }

    const canonical: CanonicalListing[] = [];
    for (const record of records) {
      const mapped = mapBrightRecord(record, { source: "bright_csv", sourceFile: file });
      if (!mapped) {
        totalSkipped++;
        continue;
      }
      // Lease-only guard: a Sale row sneaking into a Lease export is corpus
      // noise — skip rather than ingest mislabeled inventory.
      if (mapped.transactionMode !== "lease") {
        totalSkipped++;
        continue;
      }
      mapped.sourceTextHash = computeHash(mapped);
      canonical.push(mapped);
    }
    totalParsed += canonical.length;

    for (let i = 0; i < canonical.length; i += BATCH_SIZE) {
      const batch = canonical.slice(i, i + BATCH_SIZE).map(toRow);
      await db
        .insert(listings)
        .values(batch)
        .onConflictDoUpdate({
          target: [listings.mlsNumber, listings.source],
          set: {
            sourceTextHash: dsql`excluded.source_text_hash`,
            listingStatus: dsql`excluded.listing_status`,
            price: dsql`excluded.price`,
            dom: dsql`excluded.dom`,
            conditionTier: dsql`excluded.condition_tier`,
            tagSets: dsql`excluded.tag_sets`,
            publicRemarks: dsql`excluded.public_remarks`,
            utilitySystems: dsql`excluded.utility_systems`,
            data: dsql`excluded.data`,
            updatedAt: dsql`now()`,
          },
        });
      totalUpserted += batch.length;
    }
    console.log(`[ingest:lease]   ${file}: ${canonical.length} rows upserted`);
  }

  console.log(
    `[ingest:lease] Done. parsed=${totalParsed} upserted=${totalUpserted} skipped=${totalSkipped}`,
  );

  // Verify
  const sqlc = neon(url);
  const counts = (await sqlc`
    SELECT transaction_mode, listing_status, COUNT(*)::int AS n
    FROM listings GROUP BY 1, 2 ORDER BY 1, 2
  `) as Array<{ transaction_mode: string; listing_status: string; n: number }>;
  console.log("[ingest:lease] DB state:");
  for (const c of counts) {
    console.log(`    ${c.transaction_mode}/${c.listing_status}: ${c.n}`);
  }
}

main().catch((err) => {
  console.error("[ingest:lease] FAILED:", err);
  process.exit(1);
});
