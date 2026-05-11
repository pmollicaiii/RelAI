/**
 * CanonicalListing — the shape every downstream pillar consumes.
 *
 * Mirrors the @relai/db listings table columns + adds the multi-value
 * tag_sets in their parsed form. The mls-adapter parses raw CSV/XLSX
 * rows into this shape; the DB layer inserts directly from it.
 *
 * Full port of CSV/XLSX parser logic lands in Week 2 of the plan. For V1
 * scaffold we expose the type so other packages can compile against it.
 */

import { z } from "zod";

export const CanonicalListingSchema = z.object({
  mlsNumber: z.string(),
  source: z.enum(["bright_csv", "bright_api"]),
  sourceTextHash: z.string(),

  // Tier 1 — hard facts
  transactionMode: z.enum(["sale", "lease"]),
  listingStatus: z.enum([
    "active",
    "coming_soon",
    "pending",
    "sold",
    "leased",
    "withdrawn",
    "expired",
  ]),
  price: z.number().nullable(),
  originalPrice: z.number().nullable(),
  soldPrice: z.number().nullable(),
  beds: z.number().int().nullable(),
  bathsFull: z.number().int().nullable(),
  bathsPartial: z.number().int().nullable(),
  sqftAbove: z.number().int().nullable(),
  sqftBelow: z.number().int().nullable(),
  sqftInterior: z.number().int().nullable(),
  acres: z.number().nullable(),
  lotSqft: z.number().int().nullable(),
  yearBuilt: z.number().int().nullable(),
  age: z.number().int().nullable(),
  dom: z.number().int().nullable(),
  garageSpaces: z.number().int().nullable(),
  fireplaceCount: z.number().int().nullable(),
  roomCount: z.number().int().nullable(),
  stories: z.number().int().nullable(),
  floorNumber: z.number().int().nullable(),
  taxesAnnual: z.number().nullable(),
  assessment: z.number().nullable(),
  hoaFee: z.number().nullable(),
  hoaFeeFrequency: z.string().nullable(),

  // Tier 2 — ontology-mapped single-value
  architecturalStyleSlug: z.string().nullable(),
  propertyType: z.string().nullable(),
  conditionTier: z.string().nullable(),
  utilitySystems: z.record(z.string(), z.string()).nullable(),

  // Tier 3 — multi-value tag arrays
  tagSets: z.object({
    interior_features: z.array(z.string()).default([]),
    exterior_features: z.array(z.string()).default([]),
    exterior_materials: z.array(z.string()).default([]),
    lot_description: z.array(z.string()).default([]),
    garage_features: z.array(z.string()).default([]),
    fireplace_features: z.array(z.string()).default([]),
    kitchen_appliances: z.array(z.string()).default([]),
    laundry: z.array(z.string()).default([]),
    other_structures: z.array(z.string()).default([]),
    hoa_includes: z.array(z.string()).default([]),
  }),

  // Tier 4 — raw prose
  publicRemarks: z.string().nullable(),

  // Location
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  mlsArea: z.string().nullable(),
  township: z.string().nullable(),
  county: z.string().nullable(),

  // Long-tail RESO fields (preserved as-is for re-mapping when recipe bumps)
  data: z.record(z.string(), z.unknown()).default({}),
});

export type CanonicalListing = z.infer<typeof CanonicalListingSchema>;
