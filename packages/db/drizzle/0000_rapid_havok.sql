CREATE TYPE "public"."created_by" AS ENUM('llm', 'agent', 'seed');--> statement-breakpoint
CREATE TYPE "public"."embedding_kind" AS ENUM('description', 'essence', 'photo', 'soft_pref', 'search_query');--> statement-breakpoint
CREATE TYPE "public"."extraction_pass" AS ENUM('parties', 'hard_constraints', 'soft_preferences', 'contradictions', 'gaps');--> statement-breakpoint
CREATE TYPE "public"."folder_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."inference_status" AS ENUM('ok', 'cached', 'retryable_error', 'permanent_error', 'rate_limited', 'budget_capped');--> statement-breakpoint
CREATE TYPE "public"."inference_task_kind" AS ENUM('embed_listing_description', 'essence_doc_generate', 'embed_listing_essence', 'photo_characterize', 'photo_embed', 'transcribe_audio', 'diarize_audio', 'extract_parties', 'extract_hard_constraints', 'extract_soft_preferences', 'extract_contradictions', 'extract_gaps', 'embed_soft_pref_statement', 'curate_client_md', 'parse_search_query', 'embed_search_query', 'judge_listing_fit', 'map_soft_pref_to_ontology', 'packet_hero_prose', 'packet_sms_compress', 'fair_housing_screen_outbound');--> statement-breakpoint
CREATE TYPE "public"."intake_kind" AS ENUM('dictation', 'paste', 'email_thread', 'sms', 'call_audio', 'meeting_audio', 'crm_sync');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'coming_soon', 'pending', 'sold', 'leased', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."packet_event_kind" AS ENUM('opened', 'viewed_mobile', 'viewed_desktop', 'listing_viewed', 'photo_clicked', 'hearted', 'dismissed', 'tour_requested', 'dwell', 'revisit', 'shared');--> statement-breakpoint
CREATE TYPE "public"."packet_format" AS ENUM('web_link', 'pdf', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."packet_status" AS ENUM('draft', 'rendering', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quality_score_source" AS ENUM('golden_set', 'production_judge', 'agent_feedback', 'eval_regression');--> statement-breakpoint
CREATE TYPE "public"."reaction_source" AS ENUM('agent_thumb_up', 'agent_thumb_down', 'agent_picked_low_ranked', 'buyer_heart', 'buyer_dismiss', 'buyer_tour_request', 'buyer_photo_click', 'buyer_dwell', 'buyer_revisit', 'buyer_share', 'buyer_listing_open');--> statement-breakpoint
CREATE TYPE "public"."reaction_stream" AS ENUM('agent', 'buyer');--> statement-breakpoint
CREATE TYPE "public"."search_source" AS ENUM('typed', 'dictated');--> statement-breakpoint
CREATE TYPE "public"."semantic_state" AS ENUM('applied', 'no_match', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_category" AS ENUM('architectural_style', 'interior_style', 'layout', 'interior_features', 'exterior_features', 'condition', 'lifestyle_location', 'amenities', 'practical', 'avoidance_specific');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_pending_status" AS ENUM('pending', 'approved', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_polarity" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_slug_polarity" AS ENUM('bidirectional', 'pull_only', 'push_only');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_slug_status" AS ENUM('active', 'deprecated', 'merged');--> statement-breakpoint
CREATE TYPE "public"."soft_pref_status" AS ENUM('active', 'dismissed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."transaction_mode" AS ENUM('sale', 'lease');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" varchar(32) DEFAULT 'agent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "client_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"pass_number" integer NOT NULL,
	"pass_kind" "extraction_pass" NOT NULL,
	"prompt_hash" text NOT NULL,
	"model" text NOT NULL,
	"output" jsonb NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0.000000' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"status" "folder_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_hard_constraints" (
	"folder_id" uuid PRIMARY KEY NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_intake_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"kind" "intake_kind" NOT NULL,
	"raw_artifact_url" text,
	"raw_text" text,
	"speakers" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"status_reason" text
);
--> statement-breakpoint
CREATE TABLE "client_life_context" (
	"folder_id" uuid PRIMARY KEY NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_md" (
	"folder_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_md" text NOT NULL,
	"distilled_from" jsonb DEFAULT '{"hard_constraint_keys":[],"soft_pref_ids":[],"life_context_keys":[]}'::jsonb NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_by_agent_at" timestamp with time zone,
	"edited_by_agent_content_md" text
);
--> statement-breakpoint
CREATE TABLE "client_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"listing_id" uuid,
	"stream" "reaction_stream" NOT NULL,
	"source" "reaction_source" NOT NULL,
	"polarity" "soft_pref_polarity" DEFAULT 'neutral' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_id" uuid,
	"packet_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_soft_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"slug" text,
	"display_label" text NOT NULL,
	"weight" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"polarity" "soft_pref_polarity" DEFAULT 'positive' NOT NULL,
	"embedding" vector(3072),
	"confidence" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"source_kind" "intake_kind" NOT NULL,
	"source_id" uuid,
	"source_quote" text,
	"source_timestamp" text,
	"status" "soft_pref_status" DEFAULT 'active' NOT NULL,
	"created_by" "created_by" DEFAULT 'llm' NOT NULL,
	"edited_by_agent_at" timestamp with time zone,
	"ontology_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inference_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"folder_id" uuid,
	"task_kind" "inference_task_kind" NOT NULL,
	"model_used" text NOT NULL,
	"model_variant" text DEFAULT 'primary' NOT NULL,
	"prompt_hash" text NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 8) DEFAULT '0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" "inference_status" DEFAULT 'ok' NOT NULL,
	"error_class" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inference_quality_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"score_source" "quality_score_source" NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"rubric_md" text,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_compliance" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"fair_housing_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screened_at" timestamp with time zone,
	"screened_by_model" text
);
--> statement-breakpoint
CREATE TABLE "listing_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" "embedding_kind" NOT NULL,
	"model" text NOT NULL,
	"model_version" text DEFAULT 'v1' NOT NULL,
	"recipe_version" text DEFAULT 'v1' NOT NULL,
	"embedding" vector(3072),
	"embedding_photo" vector(1024),
	"source_text_hash" text NOT NULL,
	"photo_sequence" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_embeddings_identity_unique" UNIQUE("listing_id","kind","model","recipe_version","photo_sequence")
);
--> statement-breakpoint
CREATE TABLE "listing_essence" (
	"listing_id" uuid NOT NULL,
	"model" text NOT NULL,
	"recipe_version" text DEFAULT 'v1' NOT NULL,
	"essence_md" text NOT NULL,
	"source_text_hash" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_essence_identity_unique" UNIQUE("listing_id","model","recipe_version")
);
--> statement-breakpoint
CREATE TABLE "listing_photo_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"photo_url" text NOT NULL,
	"sequence" integer NOT NULL,
	"room_type" text,
	"condition_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notable_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lighting" text,
	"captioned_by_model" text,
	"captioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photo_meta_listing_sequence_unique" UNIQUE("listing_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mls_number" text NOT NULL,
	"source" text DEFAULT 'bright_csv' NOT NULL,
	"source_text_hash" text NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_mode" "transaction_mode" NOT NULL,
	"listing_status" "listing_status" NOT NULL,
	"price" numeric(12, 2),
	"original_price" numeric(12, 2),
	"sold_price" numeric(12, 2),
	"beds" integer,
	"baths_full" integer,
	"baths_partial" integer,
	"sqft_above" integer,
	"sqft_below" integer,
	"sqft_interior" integer,
	"acres" numeric(8, 4),
	"lot_sqft" integer,
	"year_built" integer,
	"age" integer,
	"dom" integer,
	"garage_spaces" integer,
	"fireplace_count" integer,
	"room_count" integer,
	"stories" integer,
	"floor_number" integer,
	"taxes_annual" numeric(10, 2),
	"assessment" numeric(12, 2),
	"hoa_fee" numeric(10, 2),
	"hoa_fee_frequency" text,
	"architectural_style_slug" text,
	"property_type" text,
	"condition_tier" text,
	"utility_systems" jsonb,
	"tag_sets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"public_remarks" text,
	"city" text,
	"state" text,
	"zip" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"mls_area" text,
	"township" text,
	"county" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "listings_mls_source_unique" UNIQUE("mls_number","source")
);
--> statement-breakpoint
CREATE TABLE "packet_compliance" (
	"packet_id" uuid PRIMARY KEY NOT NULL,
	"fair_housing_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hard_blocked" boolean DEFAULT false NOT NULL,
	"screened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"screened_by_model" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packet_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"listing_id" uuid,
	"event_kind" "packet_event_kind" NOT NULL,
	"event_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"ua_fingerprint" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packet_listing_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"hero_paragraph" text NOT NULL,
	"matched_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_photo_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packet_listing_blocks_unique" UNIQUE("packet_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"status" "packet_status" DEFAULT 'draft' NOT NULL,
	"selected_listing_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formats" jsonb DEFAULT '["web_link"]'::jsonb NOT NULL,
	"public_slug" text,
	"share_expires_at" timestamp with time zone,
	"title" text,
	"personal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendered_at" timestamp with time zone,
	CONSTRAINT "packets_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "search_judgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"fit_score" numeric(4, 3) NOT NULL,
	"one_line_why" text NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tied_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"cache_key" text NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"query_source" "search_source" DEFAULT 'typed' NOT NULL,
	"query_audio_url" text,
	"parsed_hard" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parsed_soft" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filter_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rerank_recipe_version" text DEFAULT 'v1' NOT NULL,
	"semantic_state" "semantic_state" DEFAULT 'applied' NOT NULL,
	"total_candidates" integer DEFAULT 0 NOT NULL,
	"result_listing_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soft_pref_pending" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_label" text NOT NULL,
	"proposed_aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposed_category" "soft_pref_category",
	"source_quote" text,
	"source_artifact_id" uuid,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"status" "soft_pref_pending_status" DEFAULT 'pending' NOT NULL,
	"approved_as_slug" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soft_pref_slugs" (
	"slug" text PRIMARY KEY NOT NULL,
	"category" "soft_pref_category" NOT NULL,
	"display_label" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"polarity" "soft_pref_slug_polarity" DEFAULT 'bidirectional' NOT NULL,
	"default_weight" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"related_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opposite_slug" text,
	"ontology_version" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" "created_by" DEFAULT 'seed' NOT NULL,
	"status" "soft_pref_slug_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_extractions" ADD CONSTRAINT "client_extractions_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_extractions" ADD CONSTRAINT "client_extractions_source_id_client_intake_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."client_intake_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_folders" ADD CONSTRAINT "client_folders_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_hard_constraints" ADD CONSTRAINT "client_hard_constraints_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_intake_sources" ADD CONSTRAINT "client_intake_sources_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_life_context" ADD CONSTRAINT "client_life_context_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_md" ADD CONSTRAINT "client_md_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reactions" ADD CONSTRAINT "client_reactions_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reactions" ADD CONSTRAINT "client_reactions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reactions" ADD CONSTRAINT "client_reactions_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_soft_preferences" ADD CONSTRAINT "client_soft_preferences_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_soft_preferences" ADD CONSTRAINT "client_soft_preferences_slug_soft_pref_slugs_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."soft_pref_slugs"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_soft_preferences" ADD CONSTRAINT "client_soft_preferences_source_id_client_intake_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."client_intake_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_audit" ADD CONSTRAINT "inference_audit_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_audit" ADD CONSTRAINT "inference_audit_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_quality_scores" ADD CONSTRAINT "inference_quality_scores_audit_id_inference_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."inference_audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_compliance" ADD CONSTRAINT "listing_compliance_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_embeddings" ADD CONSTRAINT "listing_embeddings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_essence" ADD CONSTRAINT "listing_essence_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photo_meta" ADD CONSTRAINT "listing_photo_meta_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packet_compliance" ADD CONSTRAINT "packet_compliance_packet_id_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packet_events" ADD CONSTRAINT "packet_events_packet_id_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packet_events" ADD CONSTRAINT "packet_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packet_listing_blocks" ADD CONSTRAINT "packet_listing_blocks_packet_id_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packet_listing_blocks" ADD CONSTRAINT "packet_listing_blocks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_judgments" ADD CONSTRAINT "search_judgments_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_judgments" ADD CONSTRAINT "search_judgments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_folder_id_client_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."client_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soft_pref_pending" ADD CONSTRAINT "soft_pref_pending_approved_as_slug_soft_pref_slugs_slug_fk" FOREIGN KEY ("approved_as_slug") REFERENCES "public"."soft_pref_slugs"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soft_pref_pending" ADD CONSTRAINT "soft_pref_pending_reviewed_by_agents_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_email_idx" ON "agents" USING btree ("email");--> statement-breakpoint
CREATE INDEX "client_extractions_folder_id_idx" ON "client_extractions" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "client_extractions_source_pass_idx" ON "client_extractions" USING btree ("source_id","pass_number");--> statement-breakpoint
CREATE INDEX "client_folders_agent_id_idx" ON "client_folders" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "client_folders_status_idx" ON "client_folders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_intake_sources_folder_id_idx" ON "client_intake_sources" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "client_intake_sources_status_idx" ON "client_intake_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_reactions_folder_idx" ON "client_reactions" USING btree ("folder_id","occurred_at");--> statement-breakpoint
CREATE INDEX "client_reactions_stream_idx" ON "client_reactions" USING btree ("folder_id","stream");--> statement-breakpoint
CREATE INDEX "client_reactions_listing_idx" ON "client_reactions" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "client_soft_preferences_folder_id_idx" ON "client_soft_preferences" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "client_soft_preferences_folder_status_idx" ON "client_soft_preferences" USING btree ("folder_id","status");--> statement-breakpoint
CREATE INDEX "client_soft_preferences_slug_idx" ON "client_soft_preferences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "inference_audit_task_kind_idx" ON "inference_audit" USING btree ("task_kind","occurred_at");--> statement-breakpoint
CREATE INDEX "inference_audit_agent_idx" ON "inference_audit" USING btree ("agent_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inference_audit_prompt_hash_idx" ON "inference_audit" USING btree ("prompt_hash");--> statement-breakpoint
CREATE INDEX "inference_quality_scores_audit_idx" ON "inference_quality_scores" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "listing_embeddings_listing_kind_idx" ON "listing_embeddings" USING btree ("listing_id","kind");--> statement-breakpoint
CREATE INDEX "listing_photo_meta_listing_idx" ON "listing_photo_meta" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listings_txn_status_idx" ON "listings" USING btree ("transaction_mode","listing_status");--> statement-breakpoint
CREATE INDEX "listings_zip_idx" ON "listings" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "listings_beds_idx" ON "listings" USING btree ("beds");--> statement-breakpoint
CREATE INDEX "listings_arch_style_idx" ON "listings" USING btree ("architectural_style_slug");--> statement-breakpoint
CREATE INDEX "listings_tag_sets_gin" ON "listings" USING gin ("tag_sets");--> statement-breakpoint
CREATE INDEX "packet_events_packet_idx" ON "packet_events" USING btree ("packet_id","occurred_at");--> statement-breakpoint
CREATE INDEX "packet_events_kind_idx" ON "packet_events" USING btree ("event_kind");--> statement-breakpoint
CREATE INDEX "packet_listing_blocks_packet_idx" ON "packet_listing_blocks" USING btree ("packet_id");--> statement-breakpoint
CREATE INDEX "packets_folder_idx" ON "packets" USING btree ("folder_id","created_at");--> statement-breakpoint
CREATE INDEX "packets_status_idx" ON "packets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_judgments_cache_key_idx" ON "search_judgments" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "search_judgments_search_listing_idx" ON "search_judgments" USING btree ("search_id","listing_id");--> statement-breakpoint
CREATE INDEX "searches_folder_idx" ON "searches" USING btree ("folder_id","created_at");--> statement-breakpoint
CREATE INDEX "searches_agent_idx" ON "searches" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "soft_pref_pending_status_idx" ON "soft_pref_pending" USING btree ("status");--> statement-breakpoint
CREATE INDEX "soft_pref_pending_label_idx" ON "soft_pref_pending" USING btree ("proposed_label");--> statement-breakpoint
CREATE INDEX "soft_pref_slugs_category_idx" ON "soft_pref_slugs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "soft_pref_slugs_status_idx" ON "soft_pref_slugs" USING btree ("status");