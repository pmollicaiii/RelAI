/**
 * RelAI database schema (Drizzle ORM)
 *
 * 22 tables across 5 layers:
 *   - Core entities: agents, client_folders
 *   - Pillar 1 (listings): listings, listing_embeddings, listing_essence,
 *     listing_photo_meta, listing_compliance
 *   - Pillar 2 (client vector): client_hard_constraints, client_soft_preferences,
 *     client_life_context, client_intake_sources, client_extractions, client_md
 *   - Pillar 3 (search): searches, search_judgments, client_reactions
 *   - Pillar 4 (packets): packets, packet_listing_blocks, packet_compliance, packet_events
 *   - Soft-pref ontology: soft_pref_slugs, soft_pref_pending
 *   - Cross-cutting: inference_audit, inference_quality_scores
 *
 * Critical contracts (do not change without updating CLAUDE.md §6):
 *   - listing_embeddings is unique on (listing_id, kind, model, recipe_version, photo_sequence)
 *   - source_text_hash gates re-embedding (see packages/embedding)
 *   - Soft-pref centroids are recomputed on-demand (no centroid table)
 *   - client_reactions has TWO streams: 'agent' (search rerank) and 'buyer' (client.md)
 *   - Search rerank uses positive + avoidance centroids; client.md NEVER restricts SQL filter
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const transactionModeEnum = pgEnum("transaction_mode", ["sale", "lease"]);
export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "coming_soon",
  "pending",
  "sold",
  "leased",
  "withdrawn",
  "expired",
]);
export const folderStatusEnum = pgEnum("folder_status", ["active", "paused", "closed"]);

export const intakeKindEnum = pgEnum("intake_kind", [
  "dictation",
  "paste",
  "email_thread",
  "sms",
  "call_audio",
  "meeting_audio",
  "crm_sync",
]);

export const extractionPassEnum = pgEnum("extraction_pass", [
  "parties",
  "hard_constraints",
  "soft_preferences",
  "contradictions",
  "gaps",
]);

export const softPrefStatusEnum = pgEnum("soft_pref_status", ["active", "dismissed", "superseded"]);

export const softPrefPolarityEnum = pgEnum("soft_pref_polarity", [
  "positive",
  "negative",
  "neutral",
]);

export const softPrefSlugPolarityEnum = pgEnum("soft_pref_slug_polarity", [
  "bidirectional",
  "pull_only",
  "push_only",
]);

export const softPrefCategoryEnum = pgEnum("soft_pref_category", [
  "architectural_style",
  "interior_style",
  "layout",
  "interior_features",
  "exterior_features",
  "condition",
  "lifestyle_location",
  "amenities",
  "practical",
  "avoidance_specific",
]);

export const softPrefSlugStatusEnum = pgEnum("soft_pref_slug_status", [
  "active",
  "deprecated",
  "merged",
]);

export const softPrefPendingStatusEnum = pgEnum("soft_pref_pending_status", [
  "pending",
  "approved",
  "rejected",
  "merged",
]);

export const createdByEnum = pgEnum("created_by", ["llm", "agent", "seed"]);

export const embeddingKindEnum = pgEnum("embedding_kind", [
  "description",
  "essence",
  "photo",
  "soft_pref",
  "search_query",
]);

export const searchSourceEnum = pgEnum("search_source", ["typed", "dictated"]);

export const semanticStateEnum = pgEnum("semantic_state", ["applied", "no_match", "unavailable"]);

export const reactionStreamEnum = pgEnum("reaction_stream", ["agent", "buyer"]);

export const reactionSourceEnum = pgEnum("reaction_source", [
  "agent_thumb_up",
  "agent_thumb_down",
  "agent_picked_low_ranked",
  "buyer_heart",
  "buyer_dismiss",
  "buyer_tour_request",
  "buyer_photo_click",
  "buyer_dwell",
  "buyer_revisit",
  "buyer_share",
  "buyer_listing_open",
]);

export const packetStatusEnum = pgEnum("packet_status", ["draft", "rendering", "ready", "failed"]);

export const packetFormatEnum = pgEnum("packet_format", ["web_link", "pdf", "email", "sms"]);

export const packetEventKindEnum = pgEnum("packet_event_kind", [
  "opened",
  "viewed_mobile",
  "viewed_desktop",
  "listing_viewed",
  "photo_clicked",
  "hearted",
  "dismissed",
  "tour_requested",
  "dwell",
  "revisit",
  "shared",
]);

export const inferenceTaskKindEnum = pgEnum("inference_task_kind", [
  "embed_listing_description",
  "essence_doc_generate",
  "embed_listing_essence",
  "photo_characterize",
  "photo_embed",
  "transcribe_audio",
  "diarize_audio",
  "extract_parties",
  "extract_hard_constraints",
  "extract_soft_preferences",
  "extract_contradictions",
  "extract_gaps",
  "embed_soft_pref_statement",
  "curate_client_md",
  "parse_search_query",
  "embed_search_query",
  "judge_listing_fit",
  "map_soft_pref_to_ontology",
  "packet_hero_prose",
  "packet_sms_compress",
  "fair_housing_screen_outbound",
]);

export const inferenceStatusEnum = pgEnum("inference_status", [
  "ok",
  "cached",
  "retryable_error",
  "permanent_error",
  "rate_limited",
  "budget_capped",
]);

export const qualityScoreSourceEnum = pgEnum("quality_score_source", [
  "golden_set",
  "production_judge",
  "agent_feedback",
  "eval_regression",
]);

// ============================================================================
// Core entities
// ============================================================================

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    role: varchar("role", { length: 32 }).default("agent").notNull(), // 'agent' | 'admin'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clerkUserIdUnique: unique("agents_clerk_user_id_unique").on(t.clerkUserId),
    emailIdx: index("agents_email_idx").on(t.email),
  }),
);

export const clientFolders = pgTable(
  "client_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    status: folderStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdIdx: index("client_folders_agent_id_idx").on(t.agentId),
    statusIdx: index("client_folders_status_idx").on(t.status),
  }),
);

// ============================================================================
// Soft-preference ontology (must precede client_soft_preferences for FK)
// ============================================================================

export const softPrefSlugs = pgTable(
  "soft_pref_slugs",
  {
    slug: text("slug").primaryKey(), // 'interior_features.kitchen_island'
    category: softPrefCategoryEnum("category").notNull(),
    displayLabel: text("display_label").notNull(), // 'kitchen island'
    aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
    polarity: softPrefSlugPolarityEnum("polarity").default("bidirectional").notNull(),
    defaultWeight: numeric("default_weight", { precision: 4, scale: 3 }).default("0.500").notNull(),
    relatedSlugs: jsonb("related_slugs").$type<string[]>().default([]).notNull(),
    oppositeSlug: text("opposite_slug"),
    ontologyVersion: integer("ontology_version").default(1).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
    addedBy: createdByEnum("added_by").default("seed").notNull(),
    status: softPrefSlugStatusEnum("status").default("active").notNull(),
  },
  (t) => ({
    categoryIdx: index("soft_pref_slugs_category_idx").on(t.category),
    statusIdx: index("soft_pref_slugs_status_idx").on(t.status),
  }),
);

export const softPrefPending = pgTable(
  "soft_pref_pending",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposedLabel: text("proposed_label").notNull(),
    proposedAliases: jsonb("proposed_aliases").$type<string[]>().default([]).notNull(),
    proposedCategory: softPrefCategoryEnum("proposed_category"),
    sourceQuote: text("source_quote"),
    sourceArtifactId: uuid("source_artifact_id"),
    occurrences: integer("occurrences").default(1).notNull(),
    status: softPrefPendingStatusEnum("status").default("pending").notNull(),
    approvedAsSlug: text("approved_as_slug").references(() => softPrefSlugs.slug),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("soft_pref_pending_status_idx").on(t.status),
    proposedLabelIdx: index("soft_pref_pending_label_idx").on(t.proposedLabel),
  }),
);

// ============================================================================
// Pillar 2: Client facets + provenance
// ============================================================================

export const clientHardConstraints = pgTable("client_hard_constraints", {
  folderId: uuid("folder_id")
    .primaryKey()
    .references(() => clientFolders.id, { onDelete: "cascade" }),
  constraints: jsonb("constraints")
    .$type<{
      budget_max?: number;
      budget_min?: number;
      beds_min?: number;
      beds_max?: number;
      baths_min?: number;
      sqft_min?: number;
      locations_allowed?: string[];
      school_district_required?: string;
      must_have?: string[];
      dealbreakers?: string[];
    }>()
    .default({})
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clientLifeContext = pgTable("client_life_context", {
  folderId: uuid("folder_id")
    .primaryKey()
    .references(() => clientFolders.id, { onDelete: "cascade" }),
  context: jsonb("context")
    .$type<{
      timeline?: string;
      motivation?: string;
      household?: {
        adults?: number;
        kids?: number;
        pets?: string[];
      };
      work?: {
        wfh?: boolean;
        commute_to?: string;
      };
      additional_facts?: string[];
    }>()
    .default({})
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clientIntakeSources = pgTable(
  "client_intake_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    kind: intakeKindEnum("kind").notNull(),
    rawArtifactUrl: text("raw_artifact_url"), // R2 key for audio; null for text
    rawText: text("raw_text"), // paste content or post-transcription text
    speakers: jsonb("speakers").$type<Array<{ id: string; label: string; role?: string }>>(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).default("pending").notNull(), // pending | processing | done | failed
    statusReason: text("status_reason"),
  },
  (t) => ({
    folderIdIdx: index("client_intake_sources_folder_id_idx").on(t.folderId),
    statusIdx: index("client_intake_sources_status_idx").on(t.status),
  }),
);

export const clientSoftPreferences = pgTable(
  "client_soft_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    slug: text("slug").references(() => softPrefSlugs.slug, { onDelete: "set null" }), // null if pending
    displayLabel: text("display_label").notNull(),
    weight: numeric("weight", { precision: 4, scale: 3 }).default("0.500").notNull(),
    polarity: softPrefPolarityEnum("polarity").default("positive").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }), // text-embedding-3-large
    confidence: numeric("confidence", { precision: 4, scale: 3 }).default("0.500").notNull(),
    sourceKind: intakeKindEnum("source_kind").notNull(),
    sourceId: uuid("source_id").references(() => clientIntakeSources.id, {
      onDelete: "set null",
    }),
    sourceQuote: text("source_quote"),
    sourceTimestamp: text("source_timestamp"), // e.g. "12:43" for audio
    status: softPrefStatusEnum("status").default("active").notNull(),
    createdBy: createdByEnum("created_by").default("llm").notNull(),
    editedByAgentAt: timestamp("edited_by_agent_at", { withTimezone: true }),
    ontologyVersion: integer("ontology_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    folderIdIdx: index("client_soft_preferences_folder_id_idx").on(t.folderId),
    folderStatusIdx: index("client_soft_preferences_folder_status_idx").on(t.folderId, t.status),
    slugIdx: index("client_soft_preferences_slug_idx").on(t.slug),
  }),
);

export const clientExtractions = pgTable(
  "client_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => clientIntakeSources.id, { onDelete: "cascade" }),
    passNumber: integer("pass_number").notNull(), // 1-5
    passKind: extractionPassEnum("pass_kind").notNull(),
    promptHash: text("prompt_hash").notNull(),
    model: text("model").notNull(),
    output: jsonb("output").notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).default("0.000000").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    folderIdIdx: index("client_extractions_folder_id_idx").on(t.folderId),
    sourcePassIdx: index("client_extractions_source_pass_idx").on(t.sourceId, t.passNumber),
  }),
);

export const clientMd = pgTable("client_md", {
  folderId: uuid("folder_id")
    .primaryKey()
    .references(() => clientFolders.id, { onDelete: "cascade" }),
  version: integer("version").default(1).notNull(),
  contentMd: text("content_md").notNull(),
  distilledFrom: jsonb("distilled_from")
    .$type<{
      hard_constraint_keys: string[];
      soft_pref_ids: string[];
      life_context_keys: string[];
      reaction_summary?: string;
    }>()
    .default({ hard_constraint_keys: [], soft_pref_ids: [], life_context_keys: [] })
    .notNull(),
  model: text("model").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  editedByAgentAt: timestamp("edited_by_agent_at", { withTimezone: true }),
  editedByAgentContentMd: text("edited_by_agent_content_md"),
});

// ============================================================================
// Pillar 1: Listings (multimodal representation)
// ============================================================================

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mlsNumber: text("mls_number").notNull(),
    source: text("source").default("bright_csv").notNull(), // 'bright_csv' | 'bright_api'
    sourceTextHash: text("source_text_hash").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    // Tier 1: Hard-fact typed columns
    transactionMode: transactionModeEnum("transaction_mode").notNull(),
    listingStatus: listingStatusEnum("listing_status").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }),
    originalPrice: numeric("original_price", { precision: 12, scale: 2 }),
    soldPrice: numeric("sold_price", { precision: 12, scale: 2 }),
    beds: integer("beds"),
    bathsFull: integer("baths_full"),
    bathsPartial: integer("baths_partial"),
    sqftAbove: integer("sqft_above"),
    sqftBelow: integer("sqft_below"),
    sqftInterior: integer("sqft_interior"),
    acres: numeric("acres", { precision: 8, scale: 4 }),
    lotSqft: integer("lot_sqft"),
    yearBuilt: integer("year_built"),
    age: integer("age"),
    dom: integer("dom"), // days on market
    garageSpaces: integer("garage_spaces"),
    fireplaceCount: integer("fireplace_count"),
    roomCount: integer("room_count"),
    stories: integer("stories"),
    floorNumber: integer("floor_number"),
    taxesAnnual: numeric("taxes_annual", { precision: 10, scale: 2 }),
    assessment: numeric("assessment", { precision: 12, scale: 2 }),
    hoaFee: numeric("hoa_fee", { precision: 10, scale: 2 }),
    hoaFeeFrequency: text("hoa_fee_frequency"),

    // Tier 2: Ontology-mapped single-value categorical
    architecturalStyleSlug: text("architectural_style_slug"),
    propertyType: text("property_type"),
    conditionTier: text("condition_tier"), // excellent | very_good | good | average | fair
    utilitySystems: jsonb("utility_systems").$type<Record<string, string>>(),

    // Tier 3: Multi-value tag arrays (GIN indexed)
    tagSets: jsonb("tag_sets")
      .$type<{
        interior_features?: string[];
        exterior_features?: string[];
        exterior_materials?: string[];
        lot_description?: string[];
        garage_features?: string[];
        fireplace_features?: string[];
        kitchen_appliances?: string[];
        laundry?: string[];
        other_structures?: string[];
        hoa_includes?: string[];
      }>()
      .default({})
      .notNull(),

    // Tier 4: Raw description prose (embedded separately)
    publicRemarks: text("public_remarks"),

    // Location
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    mlsArea: text("mls_area"),
    township: text("township"),
    county: text("county"),

    // Long-tail RESO fields not promoted to typed columns
    data: jsonb("data").default({}).notNull(),
  },
  (t) => ({
    mlsNumberSourceUnique: unique("listings_mls_source_unique").on(t.mlsNumber, t.source),
    txnStatusIdx: index("listings_txn_status_idx").on(t.transactionMode, t.listingStatus),
    zipIdx: index("listings_zip_idx").on(t.zip),
    priceIdx: index("listings_price_idx").on(t.price),
    bedsIdx: index("listings_beds_idx").on(t.beds),
    archStyleIdx: index("listings_arch_style_idx").on(t.architecturalStyleSlug),
    tagSetsGin: index("listings_tag_sets_gin").using("gin", t.tagSets),
  }),
);

export const listingEmbeddings = pgTable(
  "listing_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: embeddingKindEnum("kind").notNull(),
    model: text("model").notNull(),
    modelVersion: text("model_version").default("v1").notNull(),
    recipeVersion: text("recipe_version").default("v1").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }), // text-embedding-3-large
    // For Jina CLIP v2 photo embeddings, kind='photo' uses a separate column
    // because vector dims differ (1024 vs 3072). We store both nullable, populate one.
    embeddingPhoto: vector("embedding_photo", { dimensions: 1024 }),
    sourceTextHash: text("source_text_hash").notNull(),
    photoSequence: integer("photo_sequence"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueIdentity: unique("listing_embeddings_identity_unique").on(
      t.listingId,
      t.kind,
      t.model,
      t.recipeVersion,
      t.photoSequence,
    ),
    listingKindIdx: index("listing_embeddings_listing_kind_idx").on(t.listingId, t.kind),
    // HNSW indexes added via raw SQL in migration (Drizzle types don't yet support hnsw operator-class
    // syntax cleanly; see migrations/0001_hnsw_indexes.sql in this package).
  }),
);

export const listingEssence = pgTable(
  "listing_essence",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    recipeVersion: text("recipe_version").default("v1").notNull(),
    essenceMd: text("essence_md").notNull(),
    sourceTextHash: text("source_text_hash").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueIdentity: unique("listing_essence_identity_unique").on(
      t.listingId,
      t.model,
      t.recipeVersion,
    ),
  }),
);

export const listingPhotoMeta = pgTable(
  "listing_photo_meta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    photoUrl: text("photo_url").notNull(),
    sequence: integer("sequence").notNull(),
    roomType: text("room_type"),
    conditionSignals: jsonb("condition_signals").$type<string[]>().default([]).notNull(),
    notableFeatures: jsonb("notable_features").$type<string[]>().default([]).notNull(),
    lighting: text("lighting"),
    captionedByModel: text("captioned_by_model"),
    captionedAt: timestamp("captioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingSequenceUnique: unique("listing_photo_meta_listing_sequence_unique").on(
      t.listingId,
      t.sequence,
    ),
    listingIdx: index("listing_photo_meta_listing_idx").on(t.listingId),
  }),
);

export const listingCompliance = pgTable("listing_compliance", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  fairHousingFlags: jsonb("fair_housing_flags")
    .$type<Array<{ phrase: string; category: string; severity: string }>>()
    .default([])
    .notNull(),
  screenedAt: timestamp("screened_at", { withTimezone: true }),
  screenedByModel: text("screened_by_model"),
});

// ============================================================================
// Pillar 3: Searches + reactions
// ============================================================================

export const searches = pgTable(
  "searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    querySource: searchSourceEnum("query_source").default("typed").notNull(),
    queryAudioUrl: text("query_audio_url"), // R2 key if dictated
    parsedHard: jsonb("parsed_hard").default({}).notNull(),
    parsedSoft: jsonb("parsed_soft")
      .$type<Array<{ slug: string; weight: number; polarity: string }>>()
      .default([])
      .notNull(),
    filterSnapshot: jsonb("filter_snapshot").default({}).notNull(),
    rerankRecipeVersion: text("rerank_recipe_version").default("v1").notNull(),
    semanticState: semanticStateEnum("semantic_state").default("applied").notNull(),
    totalCandidates: integer("total_candidates").default(0).notNull(),
    resultListingIds: jsonb("result_listing_ids").$type<string[]>().default([]).notNull(),
    resultScores: jsonb("result_scores").$type<number[]>().default([]).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    folderIdx: index("searches_folder_idx").on(t.folderId, t.createdAt),
    agentIdx: index("searches_agent_idx").on(t.agentId, t.createdAt),
  }),
);

export const searchJudgments = pgTable(
  "search_judgments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    searchId: uuid("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    fitScore: numeric("fit_score", { precision: 4, scale: 3 }).notNull(),
    oneLineWhy: text("one_line_why").notNull(),
    flags: jsonb("flags").$type<string[]>().default([]).notNull(),
    tiedPreferences: jsonb("tied_preferences")
      .$type<Array<{ pref_id: string; evidence: string }>>()
      .default([])
      .notNull(),
    model: text("model").notNull(),
    cacheKey: text("cache_key").notNull(),
    cacheHit: boolean("cache_hit").default(false).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    cacheKeyIdx: index("search_judgments_cache_key_idx").on(t.cacheKey),
    searchListingIdx: index("search_judgments_search_listing_idx").on(t.searchId, t.listingId),
  }),
);

export const clientReactions = pgTable(
  "client_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    stream: reactionStreamEnum("stream").notNull(), // 'agent' | 'buyer'
    source: reactionSourceEnum("source").notNull(),
    polarity: softPrefPolarityEnum("polarity").default("neutral").notNull(),
    payload: jsonb("payload").default({}).notNull(),
    searchId: uuid("search_id").references(() => searches.id, { onDelete: "set null" }),
    packetId: uuid("packet_id"), // FK declared after packets table to avoid forward ref
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    folderIdx: index("client_reactions_folder_idx").on(t.folderId, t.occurredAt),
    streamIdx: index("client_reactions_stream_idx").on(t.folderId, t.stream),
    listingIdx: index("client_reactions_listing_idx").on(t.listingId),
  }),
);

// ============================================================================
// Pillar 4: Packets
// ============================================================================

export const packets = pgTable(
  "packets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => clientFolders.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    status: packetStatusEnum("status").default("draft").notNull(),
    selectedListingIds: jsonb("selected_listing_ids").$type<string[]>().default([]).notNull(),
    formats: jsonb("formats").$type<string[]>().default(["web_link"]).notNull(),
    publicSlug: text("public_slug"), // HMAC-signed, only set once status='ready'
    shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
    title: text("title"),
    personalNote: text("personal_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    renderedAt: timestamp("rendered_at", { withTimezone: true }),
  },
  (t) => ({
    folderIdx: index("packets_folder_idx").on(t.folderId, t.createdAt),
    statusIdx: index("packets_status_idx").on(t.status),
    publicSlugUnique: unique("packets_public_slug_unique").on(t.publicSlug),
  }),
);

export const packetListingBlocks = pgTable(
  "packet_listing_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packetId: uuid("packet_id")
      .notNull()
      .references(() => packets.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    heroParagraph: text("hero_paragraph").notNull(),
    matchedPreferences: jsonb("matched_preferences")
      .$type<Array<{ pref_id: string; pref_label: string; quote: string; evidence: string }>>()
      .default([])
      .notNull(),
    flags: jsonb("flags").$type<string[]>().default([]).notNull(),
    suggestedPhotoOrder: jsonb("suggested_photo_order").$type<number[]>().default([]).notNull(),
    model: text("model").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    packetListingUnique: unique("packet_listing_blocks_unique").on(t.packetId, t.listingId),
    packetIdx: index("packet_listing_blocks_packet_idx").on(t.packetId),
  }),
);

export const packetCompliance = pgTable("packet_compliance", {
  packetId: uuid("packet_id")
    .primaryKey()
    .references(() => packets.id, { onDelete: "cascade" }),
  fairHousingFlags: jsonb("fair_housing_flags")
    .$type<Array<{ phrase: string; category: string; severity: string; in_block_id?: string }>>()
    .default([])
    .notNull(),
  hardBlocked: boolean("hard_blocked").default(false).notNull(),
  screenedAt: timestamp("screened_at", { withTimezone: true }).defaultNow().notNull(),
  screenedByModel: text("screened_by_model").notNull(),
});

export const packetEvents = pgTable(
  "packet_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packetId: uuid("packet_id")
      .notNull()
      .references(() => packets.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    eventKind: packetEventKindEnum("event_kind").notNull(),
    eventPayload: jsonb("event_payload").default({}).notNull(),
    ipHash: text("ip_hash"),
    uaFingerprint: text("ua_fingerprint"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    packetIdx: index("packet_events_packet_idx").on(t.packetId, t.occurredAt),
    kindIdx: index("packet_events_kind_idx").on(t.eventKind),
  }),
);

// ============================================================================
// Cross-cutting: inference audit + quality scores
// ============================================================================

export const inferenceAudit = pgTable(
  "inference_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    folderId: uuid("folder_id").references(() => clientFolders.id, { onDelete: "set null" }),
    taskKind: inferenceTaskKindEnum("task_kind").notNull(),
    modelUsed: text("model_used").notNull(),
    modelVariant: text("model_variant").default("primary").notNull(), // primary | challenger
    promptHash: text("prompt_hash").notNull(),
    cacheHit: boolean("cache_hit").default(false).notNull(),
    tokensIn: integer("tokens_in").default(0).notNull(),
    tokensOut: integer("tokens_out").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).default("0").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    status: inferenceStatusEnum("status").default("ok").notNull(),
    errorClass: text("error_class"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskKindIdx: index("inference_audit_task_kind_idx").on(t.taskKind, t.occurredAt),
    agentIdx: index("inference_audit_agent_idx").on(t.agentId, t.occurredAt),
    promptHashIdx: index("inference_audit_prompt_hash_idx").on(t.promptHash),
  }),
);

export const inferenceQualityScores = pgTable(
  "inference_quality_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => inferenceAudit.id, { onDelete: "cascade" }),
    scoreSource: qualityScoreSourceEnum("score_source").notNull(),
    score: numeric("score", { precision: 4, scale: 3 }).notNull(),
    rubricMd: text("rubric_md"),
    scoredAt: timestamp("scored_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    auditIdx: index("inference_quality_scores_audit_idx").on(t.auditId),
  }),
);

// ============================================================================
// Convenience: types exported for app code
// ============================================================================

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type ClientFolder = typeof clientFolders.$inferSelect;
export type NewClientFolder = typeof clientFolders.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingEmbedding = typeof listingEmbeddings.$inferSelect;
export type NewListingEmbedding = typeof listingEmbeddings.$inferInsert;
export type ListingEssence = typeof listingEssence.$inferSelect;
export type ClientSoftPreference = typeof clientSoftPreferences.$inferSelect;
export type NewClientSoftPreference = typeof clientSoftPreferences.$inferInsert;
export type SoftPrefSlug = typeof softPrefSlugs.$inferSelect;
export type NewSoftPrefSlug = typeof softPrefSlugs.$inferInsert;
export type ClientIntakeSource = typeof clientIntakeSources.$inferSelect;
export type ClientExtraction = typeof clientExtractions.$inferSelect;
export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type SearchJudgment = typeof searchJudgments.$inferSelect;
export type ClientReaction = typeof clientReactions.$inferSelect;
export type NewClientReaction = typeof clientReactions.$inferInsert;
export type Packet = typeof packets.$inferSelect;
export type NewPacket = typeof packets.$inferInsert;
export type PacketListingBlock = typeof packetListingBlocks.$inferSelect;
export type PacketEvent = typeof packetEvents.$inferSelect;
export type InferenceAudit = typeof inferenceAudit.$inferSelect;
export type NewInferenceAudit = typeof inferenceAudit.$inferInsert;
