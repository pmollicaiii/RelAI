# RelAI — Phase 1 Prototype Build Plan (v2)

**Version**: 2.0 (research-locked, comprehensive)
**Date**: 2026-05-10
**Status**: Awaiting final approval to begin Day 1
**Domain**: relai.realty
**Repo**: github.com/pmollicaiii/RelAI (public)
**Archive**: github.com/pmollicaiii/RelAI-Archive (private)

This plan supersedes v1. Five research reports (vectorization recipe, model selection, cost + pricing, tech stack, soft-pref ontology) are baked in. The plan covers Day 1 through completed Phase 1 prototype.

---

## 0. How to read this document

- §1-3: **what + why** (product wedge, Software 3.0 principles, four pillars)
- §4-5: **shape** (architecture diagram, 15-table data model)
- §6: **UI** (every screen with reference to your V1.html / JSX design package)
- §7: **stack** (every layer with the locked choice + rationale)
- §8-11: **recipes** (vectorization, model routing, ontology, cost + pricing)
- §12: **schedule** (12-week, week-by-week, with archive-reference notes)
- §13-15: **discipline** (translation map, process rules, definition of done)
- §16: **Day 1 actions** (concrete commands)
- §17-20: **risks, out-of-scope, ratified decisions audit trail, glossary**

When reality diverges, update the doc *first*, then code. Source of truth lives at `C:/dev/RelAI/docs/phase-1-plan.md` after Day 1.

---

## 1. Product wedge

> Real estate agents need a system that knows their clients *deeply* and surfaces inventory *personally*. Generic AI tools don't have the client context. MLS-vendor tools don't have the AI. Brokerage tools have neither.

**RelAI** is the system that:

1. **Listens** to everything the agent learns about a client — five sources: live dictation, paste, call audio, meeting audio, CRM sync — and synthesizes a queryable, editable **client.md** profile with provenance on every fact
2. **Watches** the inventory through that client's eyes — every listing represented multimodally (description + LLM essence doc + photo embeddings + structured facts) so retrieval works on filter + cosine + LLM judge
3. **Drives** personalized search — agent dictates a query, system parses hard + soft prefs, hard prefs drive the SQL filter (search intent wins), soft prefs + client.md centroids drive the re-rank, top-20 cards stream in with one-line "why" explanations
4. **Composes** personalized listing packets — Claude Sonnet 4.5 writes warm narrative tied to the client's quoted preferences, four output formats (tracked web link / PDF / email / SMS), Fair-Housing-screened before render, tracked end-to-end so buyer reactions flow back into client.md

The wedge is **the client.md with provenance**. No competitor has it.

---

## 2. Foundational principles

### 2.1 Software 3.0 alignment (Karpathy)

| Principle | What it means here |
|---|---|
| LLM as runtime, not feature | Inference at every inflection point. No bolt-on chatbot. |
| Capability over feature | LLM-native primitives (extract, embed, characterize, judge, compose) compose into workflows |
| Context > prompt engineering | A dictated search isn't a search string — it's *context for a rerank pass that already knows the client* |
| Multimodal native | Photos, audio, text are peer inputs. Pipeline built day one (photos scaffolded; flip on when Bright API lands) |
| Multi-model routing | Small models for cheap structural tasks, big models for nuance. Router enforces it. A/B mechanic for swap. |
| In-context learning > fine-tuning | Frontier APIs only. Reassess at 100k+ active users. |
| Verifier > generator | Evals as first-class. Every prompt ships with ≥5 golden cases. `pnpm eval` in <60s locally. |
| Token economics | Cache aggressively. Hash-gate everything. Inference audit on every call. |

### 2.2 Autonomy slider — non-negotiable

Every AI-inferred fact is **visible and editable** by the agent. Three specific surfaces have human-in-the-loop by design:

- **Client profile generation** (in-app or CRM-pulled)
- **Search query parsing** when soft-pref extraction is uncertain (>0.7 confidence threshold)
- **Packet outbound text** before send

Always discuss other slider candidates with the user before adding. **Steve-Jobs-clean UI mentality applies to every slider** — fun, intuitive, never bureaucratic.

### 2.3 Provenance everywhere — searchable AND traceable

Every AI-inferred fact stores `(source_artifact_id, source_quote, timestamp, prompt_hash, model)`. Every soft pref clicks-to-source. Every essence doc traces to its input fields. Every rerank score traces to the preferences it tied to. **Stored as real DB rows, not JSON blobs** — provenance is queryable. The agent can search "show me every soft pref derived from the Tuesday meeting."

### 2.4 Search-drives-filter precedence (load-bearing)

- **Hard preferences from the dictated search** drive the SQL filter. Always. Period.
- **client.md NEVER constrains the filter** — it never excludes a property from consideration
- **Soft preferences from the search PLUS client.md centroids** drive the re-rank
- **First search with no client.md yet**: search query drives everything; parsed hard + soft seed the initial client.md
- **Show all hard-match candidates; rank top 20 with explanations.** Below the top-20 is the full candidate set — the agent might pick something we ranked low, and that's a signal worth capturing

This prevents long-standing-client-flavor from overpowering a fresh search intent.

### 2.5 Inference improves over time

Every router call writes `inference_audit`. Per-task eval suites run on every PR. The system gets better at:
- **The functional loop** (extraction quality, judge fit-score accuracy, packet prose quality)
- **client.md formation + evolution** (initial seed quality, drift over time, contradiction resolution)

Per-task model leaderboard in admin dashboard. A/B mechanic with manual promotion in V1.

### 2.6 End-to-end loop before depth

Every pillar reaches *shallow but working* before any pillar gets *deep*. **Week 6 demo gate**: if the full loop doesn't feel magical when *you* use it on the corpus, we pause before pouring weeks 7-12 into depth.

### 2.7 One feature at a time, fully to UI

No parallel worktrees. No backend capability ships ahead of the UI that consumes it.

### 2.8 The word "steer" is banned

Banned everywhere in app UI text, prompts, and model outputs. Loaded jargon in fair-housing-violation parlance. Use "rank," "weight," "preference," "match" instead.

### 2.9 Fair Housing — scoped narrowly to public surfaces

Fair-Housing screening **only at outbound** (packets, public client view, generated emails/SMS). Internal essence docs, client.md, soft prefs, and rankings may carry honest preferences including those that reference school district, safety, neighborhood character — these are real client preferences and the system carries them. They are **scrubbed before client- or agent-facing copy is generated**.

### 2.10 PII redacted but actionable

`redactListingPii` + `redactContactPii` apply before any LLM call (stable-ID replacement: `[CLIENT_NAME]`, `[EMAIL_xxx]`, `[PHONE_xxx]`). DB keeps the real PII. Agent UI shows real PII to the agent. LLMs only see redacted form.

---

## 3. The four pillars

### Pillar 1 — Multimodal listing understanding

Every listing represented as a rich multi-vector structured object supporting filter + vector hybrid retrieval and LLM-native reasoning at query time.

**Six-tier representation (from Report #1):**
- Tier 1: ~30 hard-fact typed columns (price, beds, sqft, location, etc.) → SQL filter
- Tier 2: ~15 ontology-mapped single-value categorical (`architectural-style.colonial`, `condition.excellent`) → faceted filter + chip surface
- Tier 3: ~10 multi-value tag arrays (`interior_features: [...]`, `exterior_features: [...]`) → JSONB + GIN; containment filter; soft-pref ontology consumer
- Tier 4: PublicRemarks → `text-embedding-3-large` (3072d)
- Tier 5: **Essence doc** (Claude Sonnet 4.5, 150-word neutral characterization) → embedded separately. The secret weapon.
- Tier 6: Per-photo (deferred until Bright photo URLs) — Jina CLIP v2 embeds + Gemini 2.5 Flash characterization (room type, condition, notable features, lighting)

Hash-gated: `source_text_hash = sha256(canonicalize({tier_1, tier_2, tier_3, public_remarks}))`. Re-sync skips unchanged listings. Recipe-version bump forces full re-embed via admin endpoint.

### Pillar 2 — Client vector with provenance (the differentiator)

A queryable, editable, **faceted** representation of a client built from five sources, with every fact tracing to source artifact + quote.

**Four facets:**
- **Hard constraints** (JSON, runs as SQL filter HINTS — see §2.4): budget bounds, beds/baths min, locations allowed, school district, dealbreakers
- **Soft preferences** (embedded preference statements with weight + polarity + provenance, drawn from the ~145-slug ontology)
- **Life context** (timeline, motivation, household, work/commute, additional facts)
- **Behavioral signal** (append-only `client_reactions`): two distinct streams — agent thumbs on search results (improves search ranking), buyer hearts/dismisses on packets (refines client.md)

**Five sources** (uniform downstream pipeline):
- Agent dictation (live, MediaRecorder → gpt-4o-transcribe)
- Paste (textarea: email body, SMS, notes)
- Call audio upload (R2 → AssemblyAI diarize → gpt-4o-transcribe)
- Meeting audio upload (same pipeline, speaker-tagged)
- CRM sync (FUB only in V1; abstract `CrmAdapter` interface for V2 expansion)

**Five-pass extraction** (Karpathy decomposition):
1. **Identify parties** (gpt-4o-mini, ~$0.0001)
2. **Hard constraints** with confidence + source_quote (gpt-4o-mini, ~$0.0003)
3. **Soft preferences** with weight + polarity + source_quote (**Claude Sonnet 4.5**, ~$0.008 — upgraded from earlier draft; nuance critical)
4. **Contradiction detection** across sources (gpt-4o-mini, ~$0.0003)
5. **Gap detection** vs canonical buyer-interview checklist (gpt-4o-mini, ~$0.0003) → "You didn't ask about commute, schools, pets" card

Total per intake: ~$0.01. Every fact stores provenance.

**client.md curation** (Claude Sonnet 4.5, regen only when source signal shifts meaningfully) → the agent-facing distilled document, viewable + editable on Profile surface.

### Pillar 3 — Personalized search

Agent dictates a search; system returns the FULL hard-match candidate set with top-20 ranked + 1-line "why" explanations grounded in source quotes.

**Pipeline:**

```
Agent dictates → Whisper transcript ("show me Bryn Mawr inventory, focus on home office")
  ↓
[1] PARSE QUERY (multi-pass, similar shape to Pillar 2 passes 2+3)
    Extract hard prefs (gpt-4o-mini) + soft prefs with ontology slugs (Claude Sonnet 4.5)
  ↓
[2] FILTER PASS (SQL, instant)
    Apply search hard prefs → candidate set (variable size, could be 50-5000)
    Client.md hard prefs surface as advisory flags on candidates that violate them
    (never excluded)
  ↓
[3] VECTOR PRE-RANK (pgvector cosine, instant)
    Score = w1·cosine(listing.essence, positive_centroid)
          - w2·cosine(listing.essence, avoidance_centroid)
          + w3·cosine(listing.description, query_vec)
    Take top 20 for judge pass; remaining candidates accessible below the fold
  ↓
[4] LLM JUDGE PASS (Gemini 2.5 Flash, parallel, streamed)
    Per top-20 listing: input = (client profile + listing essence + photo tags + query);
                       output = {fit_score 0-1, one_line_why (~12 words), flags[],
                                 tied_preferences[]}
    Cache key: (client_profile_hash, listing_id, listing_version, query_hash)
    Target >60% hit rate after folder warms up
  ↓
[5] STREAM TO UI (cards appear one by one with skeleton states)
    Below the top-20: "View all 247 matching listings →" expands the full candidate set
```

**Smart Control dashboard** (right-side panel on Search tab): the parsed soft prefs render as **green chips (pull) and red chips (push)** drawn from the ~145-slug ontology. Every chip editable / dismissible / reweightable. Toggling a chip updates the centroid in real time → next search reranks. **The UI is the math.**

**Hard prefs strip** (above results): shows parsed hard prefs from this query as a compact list ("show our work").

**Agent thumbs reorder visible top-20 instantly** (local re-blend, 0 LLM calls). Reactions feed the rerank for the next search. Critical: the agent might pick a listing we ranked low (visible below the fold) — that's a stronger signal than thumbs on the top-20.

### Pillar 4 — Personalized listing packets

Agent picks 3-5 listings from search results; system generates a packet per format with prose grounded in client's actual preferences and quotes.

**Per-listing generation** (Claude Sonnet 4.5, 1 call per listing per packet, ~$0.018):
- `hero_paragraph`: 2-3 sentences — warm narrative that *subtly sells*, opening with a listing feature tied to a client soft pref. Reads like an agent's listing description aimed at this specific buyer.
- `matched_preferences`: bullet list of fit points. **Quotes hidden by default**; hover over each bullet to reveal the source quote.
- `flags`: gentle honest tradeoffs ("above stated budget by 4%; on a busier road than past picks")
- `suggested_photo_order`: hint for which photos to feature first

**All photos shown by default** (suggested_photo_order is advisory, not exclusive). Agent can reorder manually.

**Compliance gate** (gpt-4o-mini): Fair-Housing keyword scan + LLM screen on all generated prose. Hard-block on protected-class proxies. The word "steer" never appears.

**Four output formats from one source:**
- **Tracked web link** (also serves as public client view — buyer reactions close the learning loop)
- **PDF** (React-PDF, cached in R2 with signed URLs)
- **Email HTML body** (server-side template + plain-text alt)
- **SMS one-liner** (gpt-4o-mini compresses hero_paragraph to <150 chars)

**Tracking on public link** (`packet_events` append-only):
- opened, viewed-on-mobile vs desktop, per-listing dwell time, per-photo clicks, swipe direction patterns
- hearts / dismisses, tour requests (with optional buyer note)
- re-visits (came back to this listing N times), shared-the-link (referer changes)

All flow back into `client_reactions` → refines client.md centroids → next search gets smarter.

---

## 4. Architecture (one-page mental model)

```
+-----------------------------------------------------------------+
| SURFACES (Next.js 15 app, same codebase, two responsive modes)  |
| +--------------------------+  +-----------------------------+   |
| | Agent web app            |  | Public client view          |   |
| | (desktop-first)          |  | (mobile-first, no auth)     |   |
| +--------------------------+  +-----------------------------+   |
+-----------------------------------------------------------------+
                            |
+-----------------------------------------------------------------+
| PILLARS (LLM-native capabilities)                                |
| +--------------+ +--------------+ +---------+ +--------------+  |
| | 1. Listing   | | 2. Client    | | 3. Pers | | 4. Personal  |  |
| | understand   | | vector       | | search  | | packets      |  |
| | (multimodal) | | (multisource)| | (rerank)| | (composition)|  |
| +--------------+ +--------------+ +---------+ +--------------+  |
+-----------------------------------------------------------------+
                            |
+-----------------------------------------------------------------+
| SUBSTRATE                                                        |
| - Neon Postgres 16 + pgvector + HNSW (single DB)                 |
| - Inference router (Claude / OpenAI / Gemini / Jina via single   |
|   chokepoint w/ cache + audit + PII redaction)                   |
| - Soft-preference ontology (~145 slugs across 10 categories)     |
| - Provenance store (every fact -> source artifact + quote)       |
| - PII redaction layer (stable-ID substitution before LLM)        |
| - Inngest (async jobs: ingest, embed, characterize, audio,       |
|   extraction passes, packet render, compliance screen)           |
| - Eval harness (Promptfoo, golden sets per task, <60s local run) |
+-----------------------------------------------------------------+
```

### Inference router

All LLM/embed/STT/vision goes through `packages/inference`. No raw SDK calls anywhere else. Router enforces:
- Per-task model selection (see §9)
- Content-hash cache (memoizes deterministic outputs)
- PII redaction gate before send
- Cost + latency telemetry per call (writes `inference_audit`)
- Retry with backoff for transient errors
- A/B mechanic (router config supports primary + challenger + traffic %)
- Three-layer guardrails: per-task daily ceiling, per-agent daily ceiling, org monthly budget
- Reframed as **anti-bug**, not anti-user (see §11)

### Async orchestration

Inngest replaces BullMQ + worker service. Jobs:
- `listing.ingest`, `listing.embed`, `listing.essence`, `listing.essence-embed`
- `listing.characterize-photos`, `listing.embed-photos` (dormant until Bright API)
- `listing.fair-housing-screen` (deferred — only screens at packet outbound)
- `audio.transcribe`, `audio.diarize`, `audio.transcribe-diarized`
- `client.extract-pass-{1..5}`, `client.curate-md`
- `packet.render`, `packet.compliance-screen`

---

## 5. Data model (15 tables)

### 5.1 Core entities

```
agents
  id, clerk_user_id (unique), email, name, created_at

client_folders
  id, agent_id, display_name, status, created_at
```

### 5.2 Pillar 1: listings

```
listings
  id, mls_number, source, source_text_hash, indexed_at, updated_at
  transaction_mode, listing_status
  price, beds, baths_full, baths_partial, sqft_above, sqft_below, sqft_interior,
  acres, lot_sqft, year_built, age, dom, garage_spaces, fireplace_count,
  room_count, stories, floor_number, taxes_annual, assessment, hoa_fee,
  hoa_fee_frequency, transaction_mode, status, category, property_type,
  architectural_style_slug, condition_tier, utility_systems JSONB,
  tag_sets JSONB (GIN-indexed), public_remarks,
  city, state, zip, lat, lng, mls_area, township, county

listing_embeddings
  id, listing_id, kind ('description'|'essence'|'photo'),
  model, recipe_version, ontology_version,
  embedding vector(3072 or 1024 for Jina),
  source_text_hash, photo_sequence (nullable), generated_at
  UNIQUE (listing_id, kind, model, recipe_version, photo_sequence)

listing_essence
  listing_id, model, recipe_version, essence_md, generated_at
  UNIQUE (listing_id, model, recipe_version)

listing_photo_meta (deferred until Bright API photos)
  id, listing_id, photo_url, sequence,
  room_type, condition_signals[], notable_features[], lighting,
  captioned_by_model, captioned_at

listing_compliance (lazy — populated at packet outbound time)
  listing_id, fair_housing_flags JSONB, screened_at, screened_by_model
```

### 5.3 Pillar 2: client facets + provenance

```
client_hard_constraints (1:1 with folder, JSONB)
{ budget_max, budget_min, beds_min, beds_max, baths_min,
  sqft_min, locations_allowed[], school_district_required,
  must_have[], dealbreakers[] }

client_soft_preferences
  id, folder_id, slug (ontology FK), display_label, weight (0-1),
  polarity (+/-), embedding vector(3072), confidence,
  source_kind, source_id, source_quote, source_timestamp,
  status ('active'|'dismissed'|'superseded'),
  created_by ('llm'|'agent'|'seed'), edited_by_agent_at,
  ontology_version, created_at

client_life_context (1:1, JSONB)
{ timeline, motivation, household, work, additional_facts }

client_intake_sources
  id, folder_id, kind ('dictation'|'paste'|'email_thread'|'sms'|
                       'call_audio'|'meeting_audio'|'crm_sync'),
  raw_artifact_url, raw_text, speakers JSONB,
  ingested_at, processed_at, status

client_extractions (audit of LLM passes)
  id, folder_id, source_id, pass_number (1-5), pass_kind,
  prompt_hash, model, output JSONB, tokens_in, tokens_out,
  cost_usd, latency_ms, created_at

client_md
  folder_id (PK), version, content_md, distilled_from JSONB,
  model, generated_at, edited_by_agent_at, edited_by_agent_content_md
```

### 5.4 Pillar 3: searches + reactions

```
searches
  id, folder_id, agent_id, query_text, query_source ('typed'|'dictated'),
  query_audio_url, parsed_hard JSONB, parsed_soft JSONB (slug+weight+polarity),
  filter_snapshot JSONB, rerank_recipe_version,
  total_candidates, result_listing_ids[], result_scores[],
  latency_ms, created_at

search_judgments (cache of LLM judge pass results)
  id, search_id, listing_id, fit_score, one_line_why, flags[],
  tied_preferences[], model, cache_key, generated_at

client_reactions (append-only behavioral signal — two streams)
  id, folder_id, listing_id, stream ('agent'|'buyer'),
  source ('agent_thumb_up'|'agent_thumb_down'|'agent_picked_low_ranked'|
          'buyer_heart'|'buyer_dismiss'|'buyer_tour_request'|
          'buyer_photo_click'|'buyer_dwell'|'buyer_revisit'|'buyer_share'),
  polarity (+/-/n), payload JSONB, occurred_at
```

### 5.5 Pillar 4: packets

```
packets
  id, folder_id, agent_id, status ('draft'|'rendering'|'ready'|'failed'),
  selected_listing_ids[], formats[], public_slug, share_expires_at,
  created_at, rendered_at

packet_listing_blocks
  id, packet_id, listing_id, hero_paragraph, matched_preferences JSONB,
  flags[], suggested_photo_order[], model, generated_at

packet_compliance
  packet_id, fair_housing_flags JSONB, hard_blocked bool,
  screened_at, screened_by_model

packet_events (append-only, doubles as public-link telemetry)
  id, packet_id, listing_id (nullable), event_kind, event_payload JSONB,
  ip_hash, ua_fingerprint, occurred_at
```

### 5.6 Soft-preference ontology

```
soft_pref_slugs
  slug (PK), category, display_label, aliases[],
  polarity ('bidirectional'|'pull-only'|'push-only'),
  default_weight, related_slugs[], opposite_slug,
  ontology_version, added_at, added_by, status

soft_pref_pending
  id, proposed_label, proposed_aliases[], proposed_category,
  source_quote, source_artifact_id, occurrences,
  status, reviewed_at, reviewed_by
```

### 5.7 Cross-cutting

```
inference_audit (every router call)
  id, agent_id, folder_id (nullable), task_kind, model_used, model_variant,
  prompt_hash, cache_hit, tokens_in, tokens_out, cost_usd,
  latency_ms, status, error_class, occurred_at

inference_quality_scores
  id, audit_id, score_source ('golden-set'|'production-judge'|
                              'agent-feedback'|'eval-regression'),
  score (0-1), rubric_md, scored_at
```

**Total: 16 tables.** Down from 32 in archive.

---

## 6. UI design (screen by screen)

Grounded in your V1.html + JSX prototype design package. The design system (mood / pace / voice / density "Tweaks") is preserved. Default mood: **aurora** (coastal fog, moss + amber, daylit-optimistic).

### 6.1 Sign-in / sign-up

Clerk-hosted; minimal theming to match aurora palette. After sign-in → Home Page.

### 6.2 Home Page (post-sign-in landing)

```
+------------------------------------------------------------------+
| [avatar] Patrick Mollica   Mon May 10            "The best way   |
|                                                   to predict the |
|                                                   future is to   |
|                                                   create it."    |
+------------+-----------------------------------------------------+
| Folders    |                                                      |
| ---------  |          [orb3d visualization]                       |
| Henderson  |                                                      |
|   family   |   What would you like to find?                       |
| Sarah Chen |                                                      |
| Kim & Park |   +-----------------------------------------+        |
| +new       |   | dictate, paste, upload audio, or type   |        |
|            |   +-----------------------------------------+        |
|            |   [mic]  [paste]  [upload]  [type]                   |
|            |                                                      |
|            |   After search input -> "Which client folder?"       |
|            |   -> migrate to Client Folder page                   |
+------------+-----------------------------------------------------+
```

**Top margin**: agent info + avatar + date + rotating motivational quote (curated, ~50-quote pool, deterministic-by-day).

**Left toolbar (sidebar.jsx)**: client folders list + "+ new folder" CTA.

**Center main**: SEARCH INITIATION dashboard with the orb visual (orb3d.jsx). One unified input that accepts dictation / paste / audio upload / typing. After submission, agent assigns to a folder → app migrates to Client Folder page with the search results loaded.

### 6.3 Client Folder page (3-surface carousel)

```
+------------------------------------------------------------------+
| <- back   The Hendersons                            [share][⚙]   |
+------------------------------------------------------------------+
|                  ===[ Search | Outreach | Profile ]===           |
+------------------------------------------------------------------+

(Search surface)
+------------------------------------------------------------------+
| Hard prefs from this query:                                       |
|   budget <= $850k  ·  beds >= 4  ·  zip in {19010}                |
|                                                                   |
| Results (top 20 of 247 matching listings)            [Smart Ctl] |
| +------------------------+   +--------------------------------+  |
| | [photo] 123 Oak St    |   | SMART CONTROL                  |  |
| | $785k · 4bd · 2.5ba   |   |                                |  |
| | "Quiet office, your   |   | Pull factors (green)            |  |
| |  $785k ceiling met"  |   | [✓] kitchen-island       0.9    |  |
| | 👍 👎  [-> packet]   |   | [✓] open-floor-plan      0.85   |  |
| +------------------------+   | [✓] home-office-dedicated 0.9   |  |
| ... 19 more cards          | [✓] near-good-schools    0.95   |  |
| --- view all 247 ---       |                                |  |
|                              | Push factors (red)              |  |
|                              | [✓] dim-cozy             -0.7   |  |
|                              | [✓] no-busy-road                |  |
|                              | [✓] no-shared-walls             |  |
|                              |                                |  |
|                              | + add custom                    |  |
|                              +--------------------------------+  |
+------------------------------------------------------------------+

(Outreach surface)
+------------------------------------------------------------------+
| Timeline of outreach (newest first)                               |
|                                                                   |
| Mon 4:30 PM  Packet sent (3 listings) -> tracked link  [view]    |
| Sun 11 AM    SMS sent (1 listing) -> tracked link      [view]    |
| Sat 2 PM     Email sent (5 listings) -> opened 2x      [view]    |
| ...                                                               |
+------------------------------------------------------------------+

(Profile surface)
+------------------------------------------------------------------+
| Contact info        Timeline             client.md (editable)     |
| ---------------     ---------------      -------------------------|
| Sarah & James       Tue May 10 1:30PM    # The Hendersons         |
| Hendersson          Met for coffee...                             |
|                                          ## Hard constraints      |
| sarah@...           Mon May 9 8AM        Budget $750-850k...      |
| (610) 555-...       Got their phone...                            |
|                                          ## Soft preferences      |
| 123 Current St,     Sun May 8 ...        - Quiet home office...   |
| Lower Merion                                                       |
|                                          [edit] [regenerate]      |
+------------------------------------------------------------------+
```

**Search surface**: results + Smart Control panel right side (chips with categories + weights + polarity colors). Hard prefs strip above results. "View all 247" expands beyond the top-20.

**Outreach surface**: archive of every SMS / email / PDF / weblink ever sent for this client, with status + tracking summary. Click "[view]" → expanded tracking view (opens, clicks, hearts).

**Profile surface**: contact info + timeline of interactions + the editable client.md. "Show our work" emphasis — every fact has a pencil affordance, click any item to see provenance.

### 6.4 Source intake modal

Tabs: **Dictate** (mic + live transcript preview) | **Paste** (textarea) | **Upload audio** (drag-drop + speaker tagging step) | **Sync CRM** (FUB contact picker).

Diarization is a **distinct standalone surface** when audio has multiple speakers — agent sees speaker-tagged transcript before extraction runs.

### 6.5 Listing detail (modal or side panel)

Full structured facts, all photos in a grid (room-type-tagged when photos arrive), essence doc, judge's full explanation, flags, "matched preferences" with hover-to-reveal quote tooltips.

### 6.6 Packet generator

Picks listings from search results' "selected" tray. Per-listing preview of `hero_paragraph + matched_preferences + flags`. Format toggle (web link / PDF / email / SMS). **Compliance gate** displays any flags before "Send" — hard-block on protected-class proxies, the word "steer" never appears.

### 6.7 Public client view (mobile-first)

Stack of cards, one per listing. Each: hero photo, address, basic facts, hero paragraph, photo carousel, heart / no-thanks tap, optional "request tour" CTA. No login. HMAC-signed slug URL. Tracking pixel + interaction logging.

### 6.8 Tweaks panel (preserved from V1.html)

Right-floating panel for **mood** (editorial / liminal / aurora), **pace** (motion speed 0.5x-2x), **voice** (press / always-on / whisper), **density** (compact / regular / airy). All four runtime-switchable. Default: aurora + 2x + press + compact.

### 6.9 Admin / settings

API key status, inference cost rollup (per day, per task kind), eval results summary, model leaderboard per task, **"billing preview" admin view** (what each agent would be billed under V2 pricing), folder list for admin role.

---

## 7. Tech stack (locked)

### 7.1 App + UI layer

| Choice |
|---|
| Next.js 15 App Router on Vercel Pro |
| React 19 + Tailwind CSS v4 + shadcn/ui + Radix UI |
| Framer Motion (Motion) for animation |
| Three.js (existing orb3d.jsx) for 3D orb |
| Lucide React icons |
| Inter + Instrument Serif + JetBrains Mono fonts |
| Zustand (client state) + TanStack Query v5 (server state) |
| React Hook Form + Zod (forms + validation) |
| date-fns |

### 7.2 Data + storage

| Choice |
|---|
| Neon Postgres 16 + pgvector + HNSW |
| Drizzle ORM |
| Cloudflare R2 (audio, PDFs, packet artifacts) |
| Postgres-backed cache (no Redis layer in V1) |
| Inngest (async + cron) |

### 7.3 Auth + identity

| Choice |
|---|
| Clerk (10k MAU free, B2B-ready for V2 brokerage tier) |
| HMAC-signed slugs for public packet links |

### 7.4 Inference

| Choice |
|---|
| Custom inference router (`packages/inference`, ~200 LOC) |
| Vercel AI SDK v4 for streaming UI |
| OpenAI: `text-embedding-3-large`, `gpt-4o-mini`, `gpt-4o-transcribe` |
| Anthropic: `claude-sonnet-4.5` (text + vision) |
| Google: `gemini-2.5-flash` (judge pass + photo characterization) |
| Jina CLIP v2 via Replicate (photo embeddings) |
| AssemblyAI Universal-2 (diarization) |

### 7.5 Observability + eval

| Choice |
|---|
| Sentry (errors + performance) |
| Vercel Analytics (basic product analytics) |
| `inference_audit` + admin dashboard (LLM cost + quality) |
| Promptfoo (eval framework, runs <60s locally) |
| Better Stack (uptime, free tier) |

### 7.6 Dev tooling

| Choice |
|---|
| pnpm + Turbo (monorepo) |
| TypeScript strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess |
| **Biome** (linter + formatter) |
| Vitest (unit + integration) |
| Playwright (E2E) |
| Drizzle Kit (migrations) |

### 7.7 CI/CD

- GitHub Actions: typecheck + Biome + Vitest + Promptfoo eval (non-gating) on every PR
- Vercel preview deploy per PR (automatic)
- Vercel production deploy on merge to `main` (automatic)
- Branch protection on `main`: requires PR + 1 review + CI green

### 7.8 Monorepo shape (8 packages, 1 app, 1 eval CLI)

```
apps/
  web/                Next.js 15 — the whole UI + server actions
packages/
  inference/          Router + cache + audit + PII gate + retry + A/B
  embedding/          Recipe + cosine + hash gate (ported from archive)
  pii/                redactListingPii + redactContactPii (ported)
  intent/             5-pass extraction prompts + types + Smart Control parser
  rerank/             Judge pass + centroid math (positive + avoidance)
  packet/             Composition + Fair Housing gate + format renderers
  ontology/           Soft-pref slug definitions + LLM-pending workflow
  db/                 Drizzle schema + migrations
eval/                 Promptfoo harness + golden sets per pillar
```

### 7.9 Total monthly cost (V1 dogfood)

| Service | Cost |
|---|---|
| Vercel Pro | $20 |
| Neon Postgres | Free (Hobby tier) |
| Clerk | Free (10k MAU) |
| Inngest | Free |
| Cloudflare R2 | <$1 |
| Sentry | Free tier |
| OpenAI + Anthropic + Google + Replicate + AssemblyAI | ~$30-60 |
| Domain (relai.realty already owned) | Already paid |
| GitHub | Free (public repo) |
| **Total V1 dogfood** | **~$50-80/mo** |

---

## 8. Vectorization recipe (locked from Report #1)

### Six-tier representation per listing

**Tier 1 — Hard-fact typed columns** (~30 fields). Drives SQL filter pass. Never embedded.

**Tier 2 — Normalized categorical, ontology-mapped** (~15 fields). Split Bright's `Style` into `architectural-style` + `property-type`. `PropertyCondition` → 5-tier ENUM. Utility systems → JSONB with slugged keys.

**Tier 3 — Multi-value tag arrays** (`tag_sets` JSONB, GIN-indexed). Parsed from `InteriorFeatures`, `ExteriorFeatures`, `LotDescription`, etc. Each value mapped to soft-pref ontology slug.

**Tier 4 — Description embedding**: `PublicRemarks` → OpenAI text-embedding-3-large (3072d) → `listing_embeddings.kind='description'`. PII-redacted before embed.

**Tier 5 — Essence doc**: Claude Sonnet 4.5 generates 150-word neutral characterization → embedded with text-embedding-3-large → `listing_embeddings.kind='essence'`. The secret weapon. Captures qualitative truths that no field expresses.

**Tier 6 — Per-photo multimodal** (deferred until Bright API photos arrive). Jina CLIP v2 (1024d, multimodal) + Gemini 2.5 Flash vision characterization.

### Hash gate

```
source_text_hash = sha256(canonicalize({
  tier_1_facts,           // typed columns
  tier_2_ontology_slugs,  // single-value slugs
  tier_3_tag_arrays,      // multi-value slug arrays
  public_remarks,         // raw prose
  // photo URLs excluded — Tier 6 has its own hash
}))
```

Recipe-version bump triggers full re-embed via admin endpoint.

### Cost

| Action | Cost |
|---|---|
| 17k listings, one-time, no photos | ~$110 (with Anthropic batch API for essence) |
| 17k listings, one-time, with photos when Bright unlocks | ~$330 |
| Per new listing, no photos | ~$0.012 |
| Per new listing, with photos | ~$0.087 |
| Steady-state per market per month | $5-25 |

### What we ignore

- `OwnerName`, `ListAgent*`, `ListOffice*` — PII, redacted, never embedded
- `AgentRemarks` — private notes, not embedded
- `Model`, sparse system fields, process flags

---

## 9. Model selection per inflection point (locked from Report #2)

| # | Pillar | Task | Model | Cost/call | Batch | A/B |
|---|---|---|---|---|---|---|
| 1 | 1 | `embed-listing-description` | OpenAI text-3-large | $0.00015 | yes | No (locked) |
| 2 | 1 | `essence-doc-generate` | Claude Sonnet 4.5 (batch 50% off) | $0.006 | yes | vs Gemini 2.5 Pro |
| 3 | 1 | `embed-listing-essence` | OpenAI text-3-large | $0.00015 | yes | No |
| 4 | 1 | `photo-characterize` (deferred) | Gemini 2.5 Flash (batch) | $0.0008/photo | yes | vs Claude Sonnet |
| 5 | 1 | `photo-embed` (deferred) | Jina CLIP v2 (Replicate) | $0.0003/photo | yes | No (modality lock) |
| 6 | 2 | `transcribe-audio` | OpenAI gpt-4o-transcribe | $0.006/min | no | vs AssemblyAI |
| 7 | 2 | `diarize-audio` | AssemblyAI Universal-2 | $0.37/hr | yes | vs Pyannote |
| 8 | 2 | `extract-parties` (Pass 1) | OpenAI gpt-4o-mini | $0.0001 | yes | No |
| 9 | 2 | `extract-hard-constraints` (Pass 2) | OpenAI gpt-4o-mini | $0.0003 | yes | Quality monitor |
| 10 | 2 | `extract-soft-preferences` (Pass 3) | **Claude Sonnet 4.5** | $0.008 | yes | vs GPT-4o |
| 11 | 2 | `extract-contradictions` (Pass 4) | OpenAI gpt-4o-mini | $0.0003 | yes | No |
| 12 | 2 | `extract-gaps` (Pass 5) | OpenAI gpt-4o-mini | $0.0003 | yes | No |
| 13 | 2 | `embed-soft-pref-statement` | OpenAI text-3-large | $0.00005 | yes | No |
| 14 | 2 | `curate-client-md` | Claude Sonnet 4.5 | $0.015 | yes | vs Gemini 2.5 Pro |
| 15 | 3 | `parse-search-query` | gpt-4o-mini + Claude Sonnet 4.5 | $0.003 | no | Yes |
| 16 | 3 | `embed-search-query` | OpenAI text-3-large | $0.00005 | no | No |
| 17 | 3 | `judge-listing-fit` | **Gemini 2.5 Flash** (primary A/B candidate) | $0.0005 | no | vs Claude Sonnet |
| 18 | 3 | `map-soft-pref-to-ontology` | OpenAI gpt-4o-mini | $0.0002 | yes | No |
| 19 | 4 | `packet-hero-prose` | Claude Sonnet 4.5 | $0.018 | no | vs Gemini 2.5 Pro |
| 20 | 4 | `packet-sms-compress` | OpenAI gpt-4o-mini | $0.0001 | no | No |
| 21 | 4 | `fair-housing-screen-outbound` | OpenAI gpt-4o-mini | $0.0005 | no | Quality monitor |

**On the bench (router supports A/B):** GPT-4o, Gemini 2.5 Pro, Claude Haiku 4.5.

**Vendor-locked (never A/B):** all embeddings (changing model invalidates the vector space).

### A/B swap mechanic

```typescript
{
  taskKind: 'judge-listing-fit',
  modelPrimary: 'gemini/2.5-flash',
  modelChallenger: 'anthropic/claude-sonnet-4.5',
  challengerPct: 10,
  comparisonWindow: '14d',
  autoPromote: false  // manual approval in V1
}
```

After comparison window, surface "promote challenger?" admin prompt. Manual approval gate in V1; auto-promote with circuit breaker in V2.

---

## 10. Soft-preference ontology v0 (locked from Report #5)

### 10 categories, ~145 slugs

| # | Category | Count | Examples |
|---|---|---|---|
| 1 | architectural-style | ~15 | colonial, contemporary, craftsman, victorian, mid-century-modern, farmhouse, tudor, ranch |
| 2 | interior-style | ~15 | warm-traditional, minimal-modern, transitional, industrial, scandinavian, rustic |
| 3 | layout | ~12 | open-floor-plan, defined-rooms, single-level, vaulted-ceilings, abundant-natural-light, dim-cozy |
| 4 | interior-features | ~25 | kitchen-island, walk-in-closets, hardwood-floors, fireplace-wood-burning, granite-counters, finished-basement, mudroom |
| 5 | exterior-features | ~20 | yard-large, pool-in-ground, deck, patio, fenced-yard, garage-multi-car, mature-trees, waterfront |
| 6 | condition | ~8 | new-construction, recently-renovated, well-maintained, dated-but-functional, needs-cosmetic-updates, original-charm |
| 7 | lifestyle-location | ~18 | walkable-neighborhood, suburban-quiet, urban-vibrant, rural-secluded, near-good-schools, near-public-transit |
| 8 | amenities | ~12 | home-office-dedicated, in-law-suite, guest-house, workshop, theater-room, wine-cellar, exercise-room |
| 9 | practical | ~10 | low-hoa, no-hoa, central-ac, energy-efficient, smart-home-equipped, hardwired-ethernet |
| 10 | avoidance-specific | ~10 | no-stairs, no-shared-walls, no-busy-road, no-flood-zone, no-airport-proximity |

### LLM-pending workflow

When extraction proposes a label that doesn't match any slug or alias:
1. Lands in `soft_pref_pending` with `status='pending'`
2. Counter increments on duplicate proposals
3. At **3+ occurrences across distinct clients**, surfaces in admin "Ontology Inbox"
4. Admin reviews: approve / merge / reject
5. Approved slug becomes available; existing free-text prefs re-mapped

### Bootstrap from training data

Seed script reads all 17k rows, extracts unique values from `Style`, `InteriorFeatures`, `ExteriorFeatures`, `LotDescription`, `PropertyCondition`, `SwimmingPoolType`, `OtherStructures`, `Cooling`, `PrimaryHeat`, `ElectricalSystem`, normalizes to slug shape, outputs Drizzle migration with ~100 seed slugs. Remaining ~45 (lifestyle-location, avoidance-specific, interior-style) hand-curated in week 4 based on real client intake conversations.

### Centroid math

```
positive_centroid(folder) = normalize(
  sum over active soft_prefs where polarity = '+':
    weight × confidence × embed(display_label)
)

avoidance_centroid(folder) = normalize(
  sum over active soft_prefs where polarity = '-':
    weight × confidence × embed(display_label)
)
```

**Embed the display label, not the slug.** "kitchen island" embeds meaningfully; "interior-features.kitchen.island" doesn't. Recomputed on-demand (no centroid table).

### Versioning

`ontology_version` bumps when slug labels or aliases change. Inngest job re-maps all `client_soft_preferences` to current version. Embeddings unchanged (label-based). Listing tag arrays also re-mapped.

---

## 11. Cost + pricing strategy (locked from Report #3)

### V1 dogfood phase (free, instrumented for V2)

- Free for you + ~10 friendly agents
- Full per-agent metering in `inference_audit` from day 1
- Admin dashboard shows "what we'd bill" for each agent under V2 tiers — validates envelope sizing
- "AI credits used this month" displayed in agent UI (trains intuition for V2 pricing)

### V2 paid tiers

| Tier | Price | Includes | Overage |
|---|---|---|---|
| Starter | $79/agent/mo | $20 AI credits (~1,000 searches, ~50 packets, ~5hr audio) | $1.25 per $1 inference |
| Pro (default) | $199/agent/mo | $60 AI credits (~3,000 searches, ~150 packets, ~15hr audio) | $1.20 per $1 inference |
| Team / Enterprise | custom | pooled credits across brokerage, volume discount | $1.10 per $1 inference |

**Target customer for V2 launch: solo agents** (self-serve $79-199 tier). Brokerage tier with sales-led motion comes after 100+ paying solo agents validate fit.

### Unit economics

- 100 agents on Pro: ~92% gross margin
- 1,000 agents on Pro: ~92% gross margin
- Heavy agent on overage: ~92% gross margin maintained

### Guardrails (anti-bug, NOT anti-user)

Three layers in the router:

```
Layer 1 — Per-task-kind absolute ceiling (anti-runaway-loop)
  e.g. judge-listing-fit: max 50,000 calls/day org-wide
       Only trips on infinite loop / prompt injection / abuse

Layer 2 — Per-agent daily absolute ceiling (anti-runaway-agent)
  $50/day inference per agent (extreme outlier)
       Only trips on bug or abuse

Layer 3 — Org monthly absolute ceiling (anti-disaster)
  $500/mo for V1 dogfood (will revise upward as cohort grows)
       Soft alert at 80%, hard kill at 120%
       33x headroom over expected dogfood volume
```

**At V2 the per-agent cap becomes the overage-billing meter** — same metering infrastructure, different consumer. We never deny service for legitimate use.

### Reporting cadence

- Per call: live `inference_audit` row
- Daily rollup: dashboard table (cost per task_kind, calls, cache hit rate, mean latency, spikes)
- Weekly summary: emailed Sunday (top 5 cost drivers, over-cap agents, eval regressions)
- Monthly report: drives budget review

---

## 12. 12-week schedule (revised)

Each week ships an end-to-end loop, even if shallow. No pillar gets deep before all four exist shallow. **Week 6 = demo-milestone gate.**

Archive-reference notes call out where pulling from `C:/dev/Pulse MLS Search App/` saves time. Reference, don't copy verbatim — translate to the new shape.

### Week 1 — Infrastructure (the boring foundation)

**Goal**: deployable hello-world that the rest of the plan stands on.

**Tasks**:
1. Tag archive `pre-reset-2026-05-10`, push tag
2. Init repo `pmollicaiii/RelAI`, push to GitHub
3. Scaffold Next.js 15 App Router app in `apps/web` (pnpm + Turbo + TypeScript strict)
4. Connect Clerk (reuse dev keys, document production app setup)
5. Provision Neon project `relai-prod` + Drizzle tooling
6. Wire Inngest (free account, dev key)
7. Set up Sentry + Vercel Analytics
8. Deploy hello-world to Vercel; custom domain `relai.realty` configured
9. GitHub Actions CI: typecheck + Biome + Vitest + Promptfoo (non-gating)
10. Scaffold `eval/` with empty suites + `pnpm eval` working
11. Commit `.env.example` with all expected keys

**Archive references**:
- `apps/desktop/.env.example` — env-var naming patterns
- `services/api/.env.example` — same
- `.github/workflows/ci.yml` — CI pattern (translate to new repo shape)

**Definition of done**: `https://relai.realty/sign-in` loads, you sign in, you see "Hello, agent." A PR triggers preview deploy.

### Week 2 — Pillar 1 v0: ingest + description embeddings

**Goal**: 17k listings loaded into Neon with description embeddings, hash-gated.

**Tasks**:
1. Port `packages/mls-adapter` parsers from archive
2. Create `packages/db` with Drizzle schema (listings + listing_embeddings tables)
3. Create `packages/embedding` (port `buildEmbeddingInput`, `cosine`, hash gate)
4. Create `packages/inference` router skeleton (just `embed-text` task initially)
5. Inngest function `listing.ingest`: read CSV → parse → upsert → enqueue `listing.embed`
6. Inngest function `listing.embed`: hash-gate → embed description → upsert
7. Local script: `pnpm ingest:local` to fire ingest from CSV
8. Admin endpoint: GET `/api/admin/listings/stats`
9. Sanity script: `pnpm scratch:nn` — port from `.scratch/semantic-nn-sanity.ts`

**Archive references**:
- `packages/mls-adapter/src/parsers/*` — CSV/XLSX → CanonicalListing
- `packages/mls-adapter/src/dictionary/data-dictionary.json` — field reference (306KB)
- `packages/embedding/src/embedding-input.ts` — the recipe
- `packages/embedding/src/cosine.ts` — math
- `.scratch/semantic-nn-sanity.ts` + `.txt` — sanity check pattern
- `.scratch/hash-gate-invariant.ts` — hash-gate proof

**Definition of done**: 17,000 listings in Neon. 17,000 description embeddings. Sanity script shows coherent neighbors.

**Cost**: ~$2.55 OpenAI.

### Week 3 — Pillar 1 v0.5: essence docs + photo pipeline scaffold

**Goal**: every listing has an essence doc + embedding. Photo pipeline scaffolded.

**Tasks**:
1. Inngest function `listing.essence` — Claude Sonnet 4.5 batch API
2. Inngest function `listing.essence-embed`
3. Scaffold `listing.characterize-photos` (Gemini 2.5 Flash, dormant)
4. Scaffold `listing.embed-photos` (Jina CLIP v2 via Replicate, dormant)
5. Port `prototype_media` seed (10 CC0 Unsplash images) → `listing_photo_meta` for 100 listings
6. Sanity script: essence vs description neighbor compare
7. Eval golden set v0 for Pillar 1: 30 listings × expected neighbor concepts

**Archive references**:
- `apps/desktop/src/assets/listings/*.jpg` — 10 CC0 Unsplash images + README
- Migration `0004_listing_media_seed.sql` and `0005_listing_media_placeholder_seed.sql` — seed pattern

**Definition of done**: every listing has both embeddings. Essence docs read coherently. Eval suite v0 runs.

**Cost**: ~$105 (essence docs, one-time via Anthropic batch).

### Week 4 — Pillar 2 v0: textarea intake + 5-pass extraction + ontology bootstrap

**Goal**: agent pastes a buyer description; 5 extraction passes run; structured client representation appears in UI with provenance.

**Tasks**:
1. Drizzle schema: all client_* tables + soft_pref_* tables
2. Port `redactContactPii` from archive into `packages/pii`
3. Bootstrap script: extract ~100 seed slugs from Bright training data → ontology migration
4. Hand-curate remaining ~45 slugs (lifestyle-location, avoidance-specific, interior-style)
5. Create `packages/intent` with 5 extraction prompts (Pass 3 includes ontology as in-context grounding)
6. Inngest function `client.extract` (chains 5 passes)
7. API route: POST `/api/folders/:id/sources` (paste source)
8. UI: Home Page (agent info, motivational quote, sidebar, search initiation center) — port `sidebar.jsx` + `orb3d.jsx` from V1 design package
9. UI: Client Folder page with 3-surface carousel (Search / Outreach / Profile) — port `folder.jsx`, `folder-tabs.jsx` from design package
10. UI: Profile surface with hard/soft/life-context/gaps + provenance pencil on every fact
11. Source intake modal (Paste tab only this week)
12. Eval golden set v0 for Pillar 2: 10 transcripts × expected extractions

**Archive references**:
- `services/api/src/modules/searches/intent.service.ts` — intent extraction prompt (decompose into 5 passes)
- `services/api/src/modules/folder-preferences/identity.service.ts` — identity concept
- `services/api/src/modules/folder-preferences/redact-contact-pii.ts` — contact PII redaction
- `Design package`: `sidebar.jsx`, `folder.jsx`, `folder-tabs.jsx`, `orb3d.jsx`, `data.js`, `styles.css`, `styles-v2.css`

**Definition of done**: paste a buyer description → 5-10 seconds later, structured facts appear in Profile surface with source quotes; agent can edit/dismiss/reweight any fact.

**Cost**: ~$0.01/intake.

### Week 5 — Pillar 3 v0: hybrid search + LLM judge + Smart Control

**Goal**: agent types a search; system returns 10 ranked listings with one-line whys. Smart Control shows parsed soft prefs as chips.

**Tasks**:
1. Drizzle schema: `searches`, `search_judgments`, `client_reactions`
2. Create `packages/rerank` — filter pass + vector pre-rank (positive + avoidance centroids) + judge pass
3. Inngest function `search.judge` (parallel, streamed result)
4. API route: POST `/api/folders/:id/searches`
5. UI: Search surface — query box + hard-prefs strip + result cards with thumbs
6. UI: Smart Control panel (right side) — green/red chips with weights — port `smart-control.jsx` from design
7. Local cosine re-blend on thumb (instant reorder)
8. "View all N matching listings" below top-20
9. Eval golden set v0 for Pillar 3: 10 (client, query, expected top-3) tuples

**Archive references**:
- `services/api/src/modules/listings/listings.service.ts` — search + rerank pattern (heavily simplified)
- `packages/domain/src/ranking/ranker.ts` — rerank formula
- `Design package`: `smart-control.jsx`, `pool.jsx`

**Definition of done**: type a query, see top-20 cards stream in with one-line whys within 5 seconds. Thumb a card; visible 20 reorder instantly. Smart Control chips visible and editable.

**Cost**: ~$0.05/search.

### Week 6 — Pillar 4 v0: public packet link + END-TO-END DEMO GATE

**Goal**: agent picks 3-5 listings from search results, generates a public link with personalized prose. **Full loop works end-to-end.**

**Tasks**:
1. Drizzle schema: `packets`, `packet_listing_blocks`, `packet_compliance`, `packet_events`
2. Create `packages/packet` — composition + Fair Housing gate + web renderer
3. Inngest functions: `packet.render`, `packet.compliance-screen`
4. API routes: POST `/api/folders/:id/packets`, GET `/p/:slug` (public)
5. UI: Search surface "selected" tray + packet generator + per-listing preview
6. UI: Public client view (mobile-first card stack + heart/dismiss/tour-request)
7. Outreach surface in Client Folder: archive list with status
8. Tracking: `packet_events` writes on every interaction
9. Reactions flow back into `client_reactions` (closes the loop)
10. **Demo gate review**: you use the full loop on the 17k corpus + 100 Unsplash placeholders. Does it feel magical?

**Archive references**:
- `services/api/src/modules/public-packets/*` — public packet pattern (auth, HMAC, rate limit, event log)
- `services/worker/src/processors/artifacts.processor.ts` — packet rendering pattern

**Definition of done**: paste a buyer description → search → pick listings → click "share" → open the public link on your phone → tap a heart → reload the folder → see the buyer reaction.

**Cost**: ~$0.10/packet.

### Week 7 — Pillar 2 v0.5: agent dictation

**Goal**: agent dictates (browser MediaRecorder) → transcript → 5-pass extraction.

**Tasks**:
1. Port `useVoiceRecorder` + `useShiftHoldRecord` hooks from archive
2. Inngest function `audio.transcribe` (gpt-4o-transcribe)
3. UI: source intake modal — Dictate tab with live recording + transcript preview
4. Home page mic affordance for search-initiation dictation
5. Eval extension: 5 hand-curated dictation cases

**Archive references**:
- `apps/desktop/src/hooks/useVoiceRecorder.ts`
- `apps/desktop/src/hooks/useShiftHoldRecord.ts`
- `services/api/src/modules/transcribe/*` — `/transcribe` endpoint pattern

**Definition of done**: click mic, talk for 30 seconds, let go; 8 seconds later, structured facts update the Profile surface.

### Week 8 — Pillar 2 v1: audio upload + diarization (standalone surface)

**Goal**: agent uploads a call recording or meeting audio; system diarizes + transcribes + extracts. **Diarization is a distinct, standout feature.**

**Tasks**:
1. R2 setup for audio uploads (signed POST)
2. Inngest function `audio.diarize` (AssemblyAI Universal-2)
3. Inngest function `audio.transcribe-diarized` (writes speaker-tagged transcript)
4. UI: source intake modal — Upload audio tab with speaker tagging step
5. UI: dedicated transcript-review surface (standalone — agent sees "speaker 1 said X, speaker 2 said Y" with timestamps before extraction)
6. Extraction passes consume speaker-tagged transcript (agent speech weighted differently than client speech)
7. Eval extension: 3 hand-curated multi-speaker cases

**Definition of done**: upload 30-minute meeting audio; 2-3 minutes later, structured facts appear with speaker attribution in quotes.

**Cost**: ~$0.20/30-min meeting.

### Week 9 — Pillar 3 v1: dictated search + visual selection

**Goal**: agent dictates a search; visual-similarity option appears for top results.

**Tasks**:
1. UI: search bar (Home page) accepts dictation
2. "Find more like #4" → cosine on essence vector of #4
3. Streaming UI for judge pass (cards appear one by one with skeletons)
4. Smart Control chip editing → centroid update → next search reranks immediately
5. Eval extension: 5 (dictated query, expected reorder) cases

**Definition of done**: agent dictates "show me Bryn Mawr inventory, focus on home office"; results stream in, ranked. Agent edits Smart Control chip; next search visibly reranks.

### Week 10 — Pillar 4 v1: PDF + email + SMS + compliance hardening

**Goal**: packets render in PDF + HTML email + SMS one-liner. Compliance gate is genuinely enforced.

**Tasks**:
1. React-PDF renderer in `packages/packet`
2. Email HTML body template
3. SMS one-liner generator (gpt-4o-mini compresses hero_paragraph)
4. Fair Housing gate: keyword scan + LLM screen, hard-block on protected-class proxies, "steer" never appears
5. PDFs cached in R2 with signed URLs
6. UI: packet generator format toggles
7. Eval golden set v1 for Pillar 4: 5 (client, listing) × prose-quality rubric (LLM-as-judge)

**Archive references**:
- `packages/packet-templates/*` — React-PDF templates (translate to new shape)
- `services/worker/src/processors/artifacts.processor.ts` — render pattern

**Definition of done**: agent generates a packet; previews PDF, email, SMS one-liner; compliance gate flags a deliberately-bad test phrase.

### Week 11 — Public client view polish + reaction feedback loop

**Goal**: public client view is genuinely buyer-friendly on mobile; reactions visibly improve subsequent searches; client.md regenerates from new signal.

**Tasks**:
1. Public view: photo carousel, swipe gestures, large tap targets, "request tour" CTA
2. View-token HMAC + rotation
3. Rate limiting on public endpoint
4. `packet_events` → `client_reactions` (buyer stream) → centroid update
5. UI: folder workspace shows reaction badges on cards ("buyer hearted")
6. client.md regeneration trigger on reaction-volume threshold
7. Agent receives subtle in-app notification on first buyer reaction per packet

**Definition of done**: open public link on phone; tap hearts/dismisses on 5 listings; reload folder on desktop; subsequent searches visibly skew toward hearted style; client.md shows updated soft preferences with provenance traced to buyer reactions.

### Week 12 — Eval harness fills in + friendly agent demo

**Goal**: eval suite covers all four pillars. One friendly agent onboarded. Watch what they do.

**Tasks**:
1. Pillar 1 eval (30 listings × neighbors): ≥70% expected-neighbor recall
2. Pillar 2 eval (5 passes × golden cases): ≥85% structural pass, ≥0.7 LLM-judge subjective
3. Pillar 3 eval (10 search cases): expected top-3 in returned top-5 on ≥80%
4. Pillar 4 eval (5 prose rubric cases): ≥0.8 mean rubric score
5. Admin dashboard: inference cost rollup + eval summary + "billing preview" per agent (V2 prep)
6. Onboard 1 friendly agent: 30-min walkthrough, leave them with credentials, weekly check-in
7. Collect: every search, thumb, packet, reaction → review at week 13
8. **Phase 1 retrospective**: what worked, what didn't, what's next

**Definition of done**: `pnpm eval` passes all suites. One friendly agent has used the system for at least one real client. Retrospective drafted.

---

## 13. Translation map from archive

What to port forward (translate, don't copy verbatim):

| Archive source | Port to | Why |
|---|---|---|
| `packages/embedding/src/embedding-input.ts` | `packages/embedding/` | Recipe |
| `packages/embedding/src/cosine.ts` | `packages/embedding/` | Math |
| `packages/domain/src/pii/fields.ts` + `redactListingPii` | `packages/pii/` | Field list + listing redaction |
| `services/api/src/modules/folder-preferences/redact-contact-pii.ts` | `packages/pii/` | Contact redaction |
| `packages/mls-adapter/src/parsers/*` + `dictionary/data-dictionary.json` | `packages/mls-adapter/` | CSV/XLSX parsing + grounding |
| `services/api/src/modules/searches/intent.service.ts` | `packages/intent/pass-2-hard.prompt.ts` + `pass-3-soft.prompt.ts` | Decompose intent extraction into 5 passes |
| `apps/desktop/src/hooks/useVoiceRecorder.ts` | `apps/web/src/hooks/` | Week 7 |
| `apps/desktop/src/hooks/useShiftHoldRecord.ts` | `apps/web/src/hooks/` | Week 7 |
| `apps/desktop/src/assets/listings/*.jpg` + README | `apps/web/public/seed/` | 10 CC0 Unsplash images |
| `.scratch/semantic-nn-sanity.ts` | `scripts/nn-sanity.ts` | Sanity check |
| `.scratch/hash-gate-invariant.ts` | `scripts/hash-gate-invariant.ts` | Hash-gate proof |
| The 17 MLS CSVs/XLSX | already at `C:/dev/RelAI/MLS Training Data/` | Corpus |
| Design package: `sidebar.jsx`, `folder.jsx`, `folder-tabs.jsx`, `orb3d.jsx`, `pool.jsx`, `smart-control.jsx`, `tweaks-panel.jsx`, `data.js`, `styles.css`, `styles-v2.css` | `apps/web/src/components/`, with translation to TypeScript + RSC + shadcn | UI translation |
| `services/api/src/modules/public-packets/*` | `apps/web/src/app/p/[slug]/` + `apps/web/src/server/packets/` | Public packet pattern |

What NOT to port (explicit cuts — listed in §18 out-of-scope).

---

## 14. Process discipline

Rules adopted from the archive post-mortem. Non-negotiable.

1. **No milestone ships without a demo a non-developer can react to.**
2. **No backend capability ships ahead of the UI that consumes it.**
3. **One feature at a time, fully through to UI.** No parallel worktrees.
4. **Plan doc narrows scope, never widens.** When tempted to add to V1, ask: does cutting this make the loop unconvincing? If no, defer.
5. **Documentation reflects current state, not history.** Delete superseded approaches; don't append.
6. **Gotchas → a test or a one-line README note**, not an ever-growing CLAUDE.md bullet list.
7. **If local dev breaks twice on the same root cause, fix the root cause** before the next feature.
8. **Commit cadence**: PR per feature. Small PRs. Squash-merge to `main`. No long-lived branches.
9. **Branch naming**: `phase-1/week-N-pillar-K-{feature}` for traceability.
10. **Eval before prompt change.** Every prompt edit re-runs the relevant suite.
11. **Steve-Jobs UI mentality on every screen.** Clean, intuitive, fun. Magical moments. Never bureaucratic.
12. **"Steer" is a banned word everywhere.**

---

## 15. Definition of done for Phase 1

Phase 1 ships when **all** of these are true:

- [ ] All 12 week milestones met
- [ ] `pnpm eval` passes all four pillar suites at threshold
- [ ] One friendly agent has used the system end-to-end on a real client folder
- [ ] Phase 1 retrospective drafted
- [ ] Production deploy at `https://relai.realty`
- [ ] `inference_audit` shows cost per pillar per week tracking sensibly
- [ ] Admin "billing preview" view validates V2 pricing envelope sizing
- [ ] One full demo recording (90-second screen capture)
- [ ] Zero PII has leaked to LLMs unredacted (verified by test suite)
- [ ] Fair Housing keyword + LLM screen blocks at least one deliberately-bad test phrase
- [ ] Public client view loads on mobile (Lighthouse mobile score ≥85)
- [ ] Soft-pref ontology has ~145 seeded slugs; LLM-pending workflow tested with at least one approved addition

---

## 16. Day 1 concrete actions

### 16.1 Freeze the archive

```bash
cd "C:/dev/Pulse MLS Search App"
git tag pre-reset-2026-05-10
git push origin pre-reset-2026-05-10
```

### 16.2 Initialize new repo

```bash
cd C:/dev/RelAI
git init
git branch -M main
pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir --import-alias "@/*"
echo 'packages:
  - "apps/*"
  - "packages/*"' > pnpm-workspace.yaml
git add .
git commit -m "chore: scaffold Next.js 15 app at apps/web"
git remote add origin https://github.com/pmollicaiii/RelAI.git
git push -u origin main
```

### 16.3 Set up Vercel + custom domain

- `vercel link --project relai` in `apps/web/`
- Configure custom domain `relai.realty` (DNS records: A + CNAME)
- First preview deploy on PR

### 16.4 Set up Neon

- New Neon project `relai-prod`
- pgvector extension enabled
- Note connection string → `.env.local`
- Branching enabled

### 16.5 Wire up Clerk

- New Clerk production app (separate from dev)
- Note publishable + secret keys + frontend API URL
- `.env.local` + Vercel env vars

### 16.6 Set up Inngest

- New Inngest account (free tier)
- Note `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`

### 16.7 Set up Sentry

- New Sentry project for `relai-web`
- Note DSN

### 16.8 Wire up inference vendors

- OpenAI API key (production)
- Anthropic API key (production)
- Google AI Studio key (Gemini)
- Replicate API key (Jina CLIP v2)
- AssemblyAI API key
- All four to `.env.local` + Vercel

### 16.9 GitHub Actions baseline CI

`.github/workflows/ci.yml`: typecheck + Biome + Vitest + Promptfoo (non-gating) on PR + push to main.

### 16.10 Move this plan into the new repo

```bash
mkdir -p C:/dev/RelAI/docs
# copy this plan from ~/.claude/plans/wondrous-honking-map.md to C:/dev/RelAI/docs/phase-1-plan.md
git add docs/phase-1-plan.md
git commit -m "docs: phase 1 prototype build plan v2"
git push
```

From here forward, the plan lives in the repo.

### 16.11 Confirm everything

- `https://relai.realty` returns a Vercel hello-world
- `pnpm dev` runs locally
- `pnpm build` succeeds
- GitHub Actions green on the initial commit
- All env vars in Vercel + `.env.example` published

---

## 17. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Bright API doesn't unlock during 12 weeks → photo pipeline stays scaffold | Build pipeline regardless; demo on Unsplash seed. One-flip when unlocked. |
| LLM cost overrun on essence docs ($105 → $300 if batch fails) | Hard rate limits per task kind; daily cost alerts |
| Multi-pass extraction quality on real noisy meeting audio | Golden set covers noisy cases; week 8 eval forces evaluation before week 9 builds on it |
| Week-6 demo gate fails (loop doesn't feel magical) | Stop. Don't push to weeks 7-12. Rethink before more spend. |
| Single friendly agent (week 12) isn't enough signal | Plan for 3+ agents in weeks 13-16 (Phase 2 prep) |
| Inngest free tier limits hit | Upgrade ($20/mo) when triggered |
| Neon free tier connection limits | Drizzle pooled client; upgrade ($19/mo) when triggered |
| Solo-dev burnout | Each week has definition of done; demoable progress every week |
| Gemini 2.5 Flash judge pass quality issue | Router A/B against Claude Sonnet on 10% slice; promote if quality lift is real |
| Soft-pref ontology too restrictive (LLM constantly proposes new slugs) | 3-occurrence gate prevents drift; admin reviews pending; if proposal volume spikes, expand the seed |
| Fair Housing miss (word slips through screen) | Keyword scan + LLM screen + manual review on initial 100 packets before automating |

---

## 18. Out of scope for Phase 1 (explicitly named)

Listed by name so they exist as concepts but we resist building them.

- Multi-CRM (HubSpot, Salesforce, kvCORE, BoomTown, Chime, Real Geeks) — V2
- Real-time multi-agent orchestration (autopilot) — V2
- Brokerage demand layer (reverse match) — V2
- Outcome capture (tour / offer / close) — V2
- Image board (buyer uploads dream photos) — V2 (needs photo pipeline running)
- 3D virtual tours — V3+
- Mobile native apps (iOS / Android) — V3+
- Eval gating in CI — V2 (harness exists in V1, doesn't gate)
- Fine-tuning custom models — V3+
- MCP server wrapper — V2
- Concept hierarchy ontology beyond ~145 slugs — V2
- Agent style learning — V2
- Voice-first agent UI (always-listening) — V2
- Public buyer signup (Track B consumer surface) — V2
- Production billing system (Stripe + tier enforcement) — V2 (instrumentation in V1, no enforcement)
- LLC / Bright MLS license / FH attorney / Resend DNS — Lane A (real-world setup, blocks only on a paying customer)

---

## 19. Decisions ratified (audit trail)

This plan v2 incorporates the following user-locked decisions (in order ratified):

1. New repo (RelAI) public, archive (RelAI-Archive) private. Local paths: `C:/dev/RelAI/` (active), `C:/dev/Pulse MLS Search App/` (archive read-only)
2. 4-pillar Software 3.0 scope (multimodal listings, client vector with provenance, personalized search, packets)
3. 12-week timeline with week 6 demo gate
4. Audio intake IN V1 (dictation week 7, audio + diarization week 8)
5. FUB-only CRM sync in V1
6. Photo pipeline scaffolded with placeholders; one-flip activation when Bright API unlocks
7. Search-drives-filter precedence (client.md never restricts SQL filter)
8. Show all hard-match listings; rank top 20
9. Smart Control dashboard with green (pull) and red (push) chips
10. Soft-preference ontology — 10 categories, ~145 seed slugs, LLM-pending 3-occurrence gate, embed display label (not slug)
11. Two-centroid math (positive + avoidance) recomputed on-demand
12. Multi-pass extraction (5 passes); "what did the agent forget to ask" surfaced as card
13. Provenance pencil on every AI-inferred fact; searchable
14. Inference router as hard discipline; manual A/B promotion in V1
15. Model assignments: Claude Sonnet 4.5 for essence + soft-pref + client.md + packet prose; Gemini 2.5 Flash for judge + photo characterization; gpt-4o-mini for structural extraction + classifiers; OpenAI text-3-large for all embeddings; Jina CLIP v2 for photos
16. Vectorization recipe: 6 tiers (typed / single-cat / multi-tag / desc-embed / essence-embed / per-photo-embed)
17. Hash-gated re-embedding with `source_text_hash`
18. Listing essence doc as first-class artifact (Claude Sonnet 4.5, batch API)
19. Pricing model: subscription + overage in V2 (Starter $79, Pro $199, Enterprise custom); free dogfood in V1 with full metering
20. Initial customer segment: solo agents first, brokerage later
21. Guardrails reframed: anti-bug (not anti-user); $500/mo org budget for V1
22. Tech stack: Next.js 15 + Vercel + Neon + Clerk + Inngest + Cloudflare R2 + Sentry + shadcn/Radix/Tailwind v4/Framer Motion + Zustand + TanStack Query + Drizzle + Vitest + Playwright + Promptfoo + Biome
23. Domain: relai.realty
24. Fair Housing screening only at outbound (packets, public link); not on internal essence / soft prefs / rankings
25. "Steer" banned word everywhere
26. All photos shown by default in packets
27. Quote tooltips on hover, not visible by default
28. PII redacted but actionable (stable-ID substitution, DB keeps real PII)
29. Diarization as standalone surface, not hidden in audio pipeline
30. UI layout: Home Page (top margin agent/avatar/date/quote + left toolbar folders + center search initiation); Client Folder page (3-surface carousel Search/Outreach/Profile)
31. Design system from V1.html preserved (mood / pace / voice / density Tweaks; default aurora; orb3d visualization)

---

## 20. Glossary

- **Pillar**: top-level LLM-native capability (4 of them)
- **Facet**: one of four sub-shapes of the client model (hard / soft / life / behavioral)
- **Essence doc**: 150-word Claude-generated neutral characterization of a listing
- **Judge pass**: per-listing LLM call producing `{fit_score, one_line_why, flags, tied_preferences}`
- **Provenance**: source_artifact_id + source_quote + timestamp + prompt_hash + model on every AI-inferred fact
- **Inference router**: single chokepoint for all LLM/embed/vision/STT calls; enforces cache + PII gate + audit + A/B
- **Autonomy slider**: every AI output visible + editable; autonomy granted per-task as evals prove reliability
- **Cache key**: content hash gating re-inference for deterministic tasks
- **Centroid**: weighted mean of preference embeddings (positive or avoidance) per folder, recomputed on-demand from chip toggles
- **Compliance gate**: Fair Housing screen on outbound text before any packet ships
- **Demo gate**: the week-6 milestone that proves end-to-end loop is real before deepening
- **Smart Control**: right-side dashboard on Search surface where parsed soft prefs appear as editable green (pull) / red (push) chips
- **client.md**: the distilled, agent-editable client profile document; viewable on Profile surface
- **Ontology slug**: stable namespaced ID for a soft preference (`interior-features.kitchen.island`)
- **Display label**: human-readable phrase for a slug ("kitchen island") — used for embedding
- **Tier 1-6**: levels of the vectorization recipe (typed columns / single-categorical / multi-tag arrays / description embed / essence embed / per-photo embed)
- **Anti-bug guardrail**: router-enforced absolute ceilings preventing runaway loops / abuse; reframed from anti-user
- **Steve-Jobs UI**: design principle — clean, intuitive, fun, no clutter, magical moments
- **Aurora mood**: default UI palette — coastal fog, moss + amber, daylit-optimistic
- **Diarization standalone**: speaker-tagged audio transcript surface that's a feature in itself, not buried in extraction

---

*Next action after this plan is approved: §16 Day 1 actions, in order. §16.10 moves this document into `C:/dev/RelAI/docs/phase-1-plan.md` where it becomes the source of truth from then on.*
