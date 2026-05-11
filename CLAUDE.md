# RelAI — Project Context

This file is the durable reference for anyone (human or Claude) working on this codebase. Keep it current as decisions change. The long-form plan is in [`docs/phase-1-plan.md`](docs/phase-1-plan.md); this file distills what's durable for everyday work.

**Last updated**: 2026-05-10 (Day 1 scaffold complete)

---

## 1. What this is

**RelAI** is an autopilot real-estate-agent system. Software 3.0, AI-native. The product loop:

> Five intake sources (dictation / paste / call audio / meeting audio / CRM) → structured editable `client.md` with provenance → personalized search (top-20 ranked + 1-line "why" + full hard-match candidates visible below the fold) → personalized listing packet (warm narrative grounded in client quotes) → tracked public link → buyer reactions feed back into `client.md`

**Wedge**: the `client.md` with provenance. No competitor has it.

Domain: [relai.realty](https://relai.realty). Repo: `github.com/pmollicaiii/RelAI` (public). Archive (the old M0–M19 build, preserved for reference): `github.com/pmollicaiii/RelAI-Archive` (private), tagged `pre-reset-2026-05-10`.

---

## 2. Quick start

```bash
# Prereqs: Node 20+, pnpm 10+
pnpm install
cp .env.example apps/web/.env.local        # then fill in real values
pnpm dev                                    # Turbo runs apps/web on :3000
```

Common commands:

```bash
pnpm dev          # start dev (Next.js on :3000)
pnpm build        # production build
pnpm test         # Vitest across packages
pnpm typecheck    # tsc --noEmit across packages
pnpm lint         # Biome check
pnpm format       # Biome format --write
pnpm eval         # Promptfoo eval suites (LLM evals; needs OPENAI_API_KEY)
```

---

## 3. Stack (locked from plan §7)

| Layer | Choice |
|---|---|
| App framework | Next.js 16.2.6 App Router (React 19.2.4, Turbopack) |
| Hosting | Vercel (custom domain `relai.realty`) |
| Database | Neon Postgres 16 + pgvector + HNSW |
| ORM | Drizzle (typed schema, migrations via Drizzle Kit) |
| Object storage | Cloudflare R2 (audio + PDF artifacts) |
| Auth | Clerk |
| Async | Inngest (replaces BullMQ + worker service) |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix UI primitives |
| Animation | Framer Motion (now `motion`) + Three.js for the orb |
| Icons + fonts | Lucide React + Inter, Instrument Serif, JetBrains Mono |
| State | Zustand (client) + TanStack Query v5 (server) |
| Forms | React Hook Form + Zod |
| Inference | OpenAI + Anthropic + Google + Replicate + AssemblyAI — all behind `packages/inference` router |
| Errors / perf | Sentry |
| Eval | Promptfoo (`pnpm eval`, <60s local) |
| Linter / formatter | Biome 1.9.4 |
| Tests | Vitest (unit/integration) + Playwright (E2E) |
| Monorepo | pnpm workspaces + Turbo 2.9 |
| Node / pnpm | Node 20+, pnpm 10 (`pnpm@10.33.0`) |

---

## 4. Repo layout

```
RelAI/
├── apps/
│   └── web/                  @relai/web   Next.js 16 — the whole UI + server actions
├── packages/
│   ├── inference/            @relai/inference   Router + cache + audit + PII gate + retry + A/B
│   ├── embedding/            @relai/embedding   Recipe + cosine + hash gate
│   ├── pii/                  @relai/pii         redactListingPii + redactContactPii
│   ├── intent/               @relai/intent      5-pass extraction prompts + types
│   ├── rerank/               @relai/rerank      Judge pass + two-centroid math
│   ├── packet/               @relai/packet      Composition + Fair Housing gate + format renderers
│   ├── ontology/             @relai/ontology    ~145 soft-pref slugs + LLM-pending workflow
│   ├── mls-adapter/          @relai/mls-adapter Bright CSV/XLSX → CanonicalListing
│   └── db/                   @relai/db          Drizzle schema + migrations + client
├── eval/                     @relai/eval        Promptfoo harness + golden sets per pillar
├── seed-data/
│   └── mls/                  18 Bright training-data exports (~17k rows, 37 MB)
├── docs/
│   ├── phase-1-plan.md       The locked V1 plan (1,393 lines, source of truth)
│   └── design-reference/     Claude Design handoff (HTML/JSX/CSS)
│       └── ripple/
└── .github/workflows/ci.yml  Typecheck + Biome + Vitest + non-gating evals
```

The plan refers to "eight packages"; the actual count is nine because `mls-adapter` was ported from the archive and kept distinct from `embedding` (the recipe lives in `embedding`, the parsing in `mls-adapter`). Same architectural shape.

---

## 5. Database schema (16 load-bearing tables)

The source of truth is `packages/db/src/schema.ts`. Summary:

| Table | Purpose |
|---|---|
| `agents` | Clerk-linked agent identity |
| `client_folders` | Per-client workspaces |
| `client_hard_constraints` | JSONB hard prefs (1:1 with folder) |
| `client_soft_preferences` | Embedded soft prefs with weight/polarity/provenance, ontology FK |
| `client_life_context` | JSONB life context (timeline, household, work, etc.) |
| `client_intake_sources` | Dictation/paste/audio/CRM sources with raw transcript |
| `client_extractions` | Audit of 5-pass LLM extraction (per source per pass) |
| `client_md` | The distilled, agent-editable client profile document |
| `listings` | Hybrid: typed hot columns + JSONB `data` envelope |
| `listing_embeddings` | pgvector — kind ∈ {description, essence, photo}; HNSW indexed |
| `listing_essence` | LLM-generated 150-word characterization |
| `listing_photo_meta` | Per-photo: room_type, condition signals, lighting (deferred until photos) |
| `listing_compliance` | Fair Housing flags (lazy, populated at packet outbound) |
| `searches` | Audit per search (query, parsed prefs, candidates, results) |
| `search_judgments` | Cache of LLM judge pass results, keyed by content hash |
| `client_reactions` | Append-only behavioral signals (agent stream + buyer stream) |
| `packets` | Packet aggregate (formats, public_slug, status) |
| `packet_listing_blocks` | Per-listing prose (hero_paragraph, matched_preferences, flags) |
| `packet_compliance` | Per-packet Fair Housing screen result |
| `packet_events` | Append-only public-link telemetry (opens, hearts, dwell, etc.) |
| `soft_pref_slugs` | Ontology — ~145 slugs across 10 categories |
| `soft_pref_pending` | LLM-proposed labels awaiting admin review (3-occurrence gate) |
| `inference_audit` | Per-call audit (model, cost, latency, cache_hit) |
| `inference_quality_scores` | Eval-driven quality scores per call |

The original plan lists 16 tables; we ended up at 22 because the `_audit` + `_compliance` + `client_md` tables split out from JSONB into proper rows for clean querying. Still way under the 32 in the archive.

---

## 6. Load-bearing contracts (do not quietly change)

### 6.1 PII redaction is a pre-LLM gate

`packages/pii/src/fields.ts` lists every path with PII. All non-UI surfaces (logs, embeddings, essence-doc inputs, packet prose generation) route through `redactListingPii()` or `redactContactPii()`. Stable-ID substitution preserves the structure (`[CLIENT_NAME]`, `[EMAIL_xxx]`). Real PII lives in the DB; agent UI shows real PII; LLMs only see redacted form. Adding a new PII path requires updating fields list **AND** the test in the same PR — the test is the gate.

### 6.2 Embedding identity tuple

`(listing_id, kind, model, recipe_version, photo_sequence?)` — unique constraint lets model/recipe A/B rows coexist. `EMBEDDING_RECIPE_VERSION` env bump triggers admin-driven backfill. Never silently re-embed.

### 6.3 Three-state semantic contract

Every search row records `semanticState ∈ {applied, no-match, unavailable}`:
- `applied` = cosine ran, score ≥ 0
- `no-match` = cosine ran, score clamped from negative to 0
- `unavailable` = cosine didn't run (missing embedding / OpenAI down / no soft prefs)

Never collapse `no-match` and `unavailable` — that's load-bearing for the hidden-penalty guarantee.

### 6.4 Search-drives-filter precedence

**Hard preferences from the dictated search drive the SQL filter. Always.** The `client.md` **never** constrains the filter — it never excludes a property from consideration. Only soft preferences from search + `client.md` centroids drive the re-rank. First search ever (no `client.md` yet): search query drives everything; parsed hard+soft seed the initial `client.md`.

This rule prevents long-standing-client-flavor from overpowering a fresh search.

### 6.5 Show all hard-match listings; rank top 20

Result set always exposes the **full** hard-match candidate count. The top 20 are ranked + LLM-judged. Below the top-20: a "view all N matching listings" expand affordance. The agent may pick a low-ranked listing — that's a stronger signal than thumbs on the top-20, captured as `agent_picked_low_ranked` in `client_reactions`.

### 6.6 Two-centroid math

`positive_centroid` and `avoidance_centroid` per folder, recomputed on-demand (no centroid table). Weighted mean of soft-pref embeddings by `(weight × confidence)`, embeddings done on `display_label` not on slug. Toggling a chip in the Smart Control updates the centroid → next search reranks. **The UI is the math.**

### 6.7 Inference router is the only chokepoint

All LLM/embed/STT/vision calls go through `packages/inference`. No raw SDK calls anywhere else. Router enforces:
- Per-task model selection (see §9 of plan)
- Content-hash cache (memoizes deterministic outputs)
- PII redaction gate before send
- Cost + latency telemetry (writes `inference_audit`)
- Retry with backoff for transient errors
- A/B mechanic with manual approval in V1
- Three-layer guardrails (per-task daily, per-agent daily, org monthly) — **anti-bug, not anti-user**

### 6.8 Fair Housing scoped narrowly

Screening **only** at outbound (packets, public client view, generated emails/SMS). Internal essence docs, `client.md`, soft prefs, rankings may carry honest preferences (school district, safety, neighborhood character). These are scrubbed **before** client/agent-facing copy is generated.

### 6.9 "Steer" is banned

The word "steer" never appears in app UI text, prompts, or model outputs. Loaded jargon in Fair-Housing-violation parlance.

### 6.10 Hash-gated re-embedding

```
source_text_hash = sha256(canonicalize({
  tier_1_facts,           // typed columns
  tier_2_ontology_slugs,  // single-value slugs
  tier_3_tag_arrays,      // multi-value slug arrays
  public_remarks,         // raw prose
}))
```
Stored on every `listing_embeddings` row. Re-sync skips listings whose hash matches. Recipe-version bump (e.g. adding a Tier 2 field) is the deliberate act that forces full re-embed via admin endpoint.

### 6.11 Soft-preference ontology slug discipline

The LLM's Pass-3 extraction prompt includes the full ontology (~145 slugs across 10 categories) as in-context grounding. The LLM **cannot** invent slugs silently; novel labels land in `soft_pref_pending` and surface in admin "Ontology Inbox" at 3+ occurrences. Adding a slug requires migration + alias update + test.

### 6.12 Engagement is two streams

`client_reactions.stream ∈ {'agent', 'buyer'}`:
- **Agent stream** (thumbs on search results) → improves search rank algorithm
- **Buyer stream** (hearts/dismisses/tour-requests on packets) → refines `client.md`

Don't blend them — they teach different things.

---

## 7. Bootstrap from a fresh clone

1. **Prereqs**: Node 20+, pnpm 10+, accounts at Vercel + Neon + Clerk + Inngest + Sentry + the inference vendors
2. `pnpm install`
3. **Provision Neon**: new project `relai-prod`, enable `vector` extension, note `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
4. **Provision Clerk**: new production app, copy keys + webhook secret
5. **Provision Inngest**: free account, copy `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`
6. **Provision Sentry**: new project `relai-web` (Next.js), copy `NEXT_PUBLIC_SENTRY_DSN`
7. **Provision R2**: create bucket `relai-prod`, scoped Object Read & Write token, note jurisdictional endpoint URL
8. **Inference keys**: OpenAI + Anthropic + Google AI Studio + Replicate + AssemblyAI
9. `cp .env.example apps/web/.env.local` and fill in everything
10. `pnpm --filter @relai/db db:migrate` — applies initial schema + seeds ontology
11. `pnpm --filter @relai/db ingest:local` — ingests `seed-data/mls/` into Neon (≈17k listings)
12. `pnpm dev` — Vite on `:3000`
13. Sign in via Clerk → create folder → paste a buyer description → run a search → generate a packet

**Resetting the local DB** (greenfield only — OK until prod users exist):
```bash
# Neon: drop + recreate the database via console, then:
pnpm --filter @relai/db db:migrate
pnpm --filter @relai/db ingest:local
```

---

## 8. Environment variables

Canonical values live in root `.env.example`. Copy into `apps/web/.env.local`. NEVER commit a populated `.env.local`. Summary:

| Var | Required for | Notes |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | DB | Neon pooled + direct |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | Auth | Clerk |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Storage | Cloudflare R2 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Async | Inngest |
| `NEXT_PUBLIC_SENTRY_DSN` | Errors | Sentry |
| `OPENAI_API_KEY` | LLM | Required for any inference |
| `ANTHROPIC_API_KEY` | LLM | Essence, soft-pref extraction, packet prose, client.md |
| `GOOGLE_GENAI_API_KEY` | LLM | Gemini 2.5 Flash judge pass + photo VLM |
| `REPLICATE_API_TOKEN` | Embeddings | Jina CLIP v2 photo embeddings |
| `ASSEMBLYAI_API_KEY` | Audio | Multi-speaker diarization |
| `EMBEDDING_RECIPE_VERSION` | Recipe gate | Default `v1` |
| `ONTOLOGY_VERSION` | Ontology gate | Default `1` |
| `INFERENCE_MONTHLY_BUDGET_USD` | Guardrail | Default `500` (V1) |
| `INFERENCE_AGENT_DAILY_CAP_USD` | Guardrail | Default `50` |
| `INFERENCE_TASK_DAILY_CALL_CAP` | Guardrail | Default `50000` |

---

## 9. Data corpus

`seed-data/mls/` contains 18 Bright exports: 9 PA/NJ/DE counties × (Residential Sale | Residential Lease), ~37 MB, mix of `.csv` and `.xlsx`. Union schema: 95 unique fields. Total rows after ingest: ~17,264. Philadelphia lease (~10.7 MB) is the largest single file.

After ingest, two embedding scopes coexist in the DB (description + essence). Per-photo embeddings activate when Bright API photo URLs land.

---

## 10. Development workflow

**Run the stack**: `pnpm dev` (Next.js dev server).

**Migrations**:
- Generate from schema: `pnpm --filter @relai/db db:generate`
- Apply: `pnpm --filter @relai/db db:migrate`
- Drizzle Studio: `pnpm --filter @relai/db db:studio`

**Admin actions** (require Clerk JWT with `publicMetadata.role === "admin"`):
- Trigger MLS resync: `POST /api/admin/listings/sync`
- Embedding backfill: `POST /api/admin/embeddings/backfill` with `{reason: 'missing' | 'recipe-mismatch' | 'all'}`
- Ontology inbox: `GET /api/admin/ontology/pending` + `POST /api/admin/ontology/pending/:id/{approve,reject,merge}`
- LLM cost rollup: `GET /api/admin/inference/cost`
- Eval results: `GET /api/admin/eval/results`

**Scratch scripts**:
- `pnpm scratch:nn` — semantic neighbor sanity check on the recipe
- `pnpm scratch:hash-gate` — proves `source_text_hash` invariant holds across re-ingest

---

## 11. Process discipline (the 12 rules)

From plan §14. Non-negotiable.

1. No milestone ships without a demo a non-developer can react to.
2. No backend capability ships ahead of the UI that consumes it.
3. One feature at a time, fully through to UI. No parallel worktrees.
4. The plan doc narrows scope, never widens.
5. Documentation reflects current state, not history.
6. New gotchas → a test or a one-line README note, not a CLAUDE.md bullet list.
7. If local dev breaks twice on the same root cause, fix the root cause before the next feature.
8. PR per feature. Small PRs. Squash-merge to `main`. No long-lived branches.
9. Branch naming: `phase-1/week-N-pillar-K-{feature}`.
10. Eval before prompt change. Every prompt edit re-runs the relevant suite.
11. Steve-Jobs UI mentality on every screen. Clean, intuitive, fun. No clutter.
12. **"Steer" is a banned word everywhere.**

---

## 12. Files that must stay in sync

These pairs/triples drift quietly. Update them together in the same PR.

- **PII field list** — `packages/pii/src/fields.ts` + `packages/pii/src/pii.test.ts`. Test fails loud as the gate.
- **Embedding recipe** — `packages/embedding/src/embedding-input.ts` + `EMBEDDING_RECIPE_VERSION` env + admin backfill reasons. Bumping the version is a deliberate ops act.
- **Soft-pref ontology** — `packages/ontology/src/slugs.ts` (the ~145 slugs) + `ONTOLOGY_VERSION` env + Drizzle migration that seeds them. Adding a slug requires alias updates + `soft_pref_pending` review.
- **Schema types** — `packages/db/src/schema.ts` (Drizzle tables) + `packages/db/src/types.ts` (inferred + Zod re-exports). New DB field → regenerate migration + update types.
- **Inference task kinds** — `packages/inference/src/types.ts` (`Task` discriminated union) + `packages/inference/src/router.ts` (`ROUTER` map). Adding a task kind requires both.
- **Env defaults** — root `.env.example` + `apps/web/.env.local.example` if one is added. Keep the contents identical.
- **Signal source enum (`client_reactions.source`)** — Drizzle enum + Zod schema + rerank weight map + tests. Adding a value requires all three.
- **MLS field map** — when Bright API arrives or new RESO fields appear, update `packages/mls-adapter/src/dictionary/data-dictionary.json` (regenerate) + Tier 1/2/3 mapping in `packages/embedding/src/embedding-input.ts` + recipe version.
- **Fair Housing keyword list** — `packages/packet/src/fair-housing/keywords.ts` + test suite. New banned phrase requires test case.

---

## 13. Known gotchas

- **Next.js 16.2.6 is newer than most LLM training data.** APIs/conventions may differ from what's in your head. `apps/web/AGENTS.md` is a built-in reminder: read `node_modules/next/dist/docs/` if uncertain. Heed deprecation notices.
- **Tailwind CSS v4** uses `@import "tailwindcss"` in `globals.css` (not `@tailwind` directives) and has a different config shape than v3. The PostCSS plugin is `@tailwindcss/postcss`.
- **Biome v1.9 ships linter + formatter**. We do not use ESLint or Prettier. `pnpm lint` runs `biome check .`; `pnpm format` runs `biome format --write .`.
- **Line endings**: Git on Windows defaults to `core.autocrlf=true`. You'll see LF→CRLF warnings on first add. Harmless — repo stores LF, working copy gets CRLF.
- **pnpm `ignoredBuiltDependencies`** for `sharp` and `unrs-resolver` lives in root `pnpm-workspace.yaml`. Other native deps may need addition.
- **Vercel preview deploys** auto-run on every PR. Production deploys auto-trigger on merge to `main`. Branch protection on `main` requires PR + 1 review + CI green.
- **Neon free tier** has connection limits (~100 concurrent). Use Drizzle's pooled client (`DATABASE_URL`) for app traffic; reserve `DATABASE_URL_UNPOOLED` for migrations + admin scripts.
- **Inngest free tier** has function execution limits. Watch the daily summary; upgrade to Pro ($20/mo) when triggered (not before).
- **OpenAI batch API** is 50% off for non-urgent jobs (essence docs, photo characterization, bulk extraction). Anthropic batch is also 50% off. The inference router dispatches batch-eligible tasks via the batch endpoint automatically when the task config has `batchEligible: true` and the job has `urgency: 'background'`.
- **The word "steer"** is banned everywhere — app text, prompts, model outputs. The Fair Housing screen on outbound packets is the last guard, but don't let it slip earlier.
- **No raw SDK calls** outside `packages/inference`. Importing `openai`, `@anthropic-ai/sdk`, etc. directly in `apps/web/` or any other package is a Biome lint error. Use the router.
- **Local dev without API keys**: the inference router has a `mock` mode (env var `INFERENCE_MODE=mock`). Returns deterministic stub outputs so the app boots and pages render. NEVER ship `INFERENCE_MODE=mock` to prod.
- **The archive repo** at `C:/dev/Pulse MLS Search App/` and `github.com/pmollicaiii/RelAI-Archive` is **READ-ONLY reference**. Never `git pull` it. Never write to its directory. The translation map in `docs/phase-1-plan.md` §13 lists what was ported forward.

---

## 14. Plan + decision audit trail

The plan lives at [`docs/phase-1-plan.md`](docs/phase-1-plan.md) and is the single source of truth. §19 of the plan is the audit trail: every architectural decision ratified during the 5-research-report planning conversation (2026-05-10), in order. When you forget *why* a choice was made, that's where to look.

**Major locked decisions** (full list in plan §19):
- 4-pillar Software 3.0 scope; 12-week timeline; week-6 demo gate
- Search-drives-filter precedence (client.md never restricts SQL)
- Show all hard-match listings, rank top 20
- ~145-slug soft-preference ontology with 3-occurrence LLM-pending gate
- Two-centroid math (positive + avoidance), recomputed on-demand
- 5-pass extraction (parties / hard / soft / contradictions / gaps)
- Inference router as hard discipline; manual A/B promotion in V1
- Model assignment: Claude Sonnet 4.5 (essence + soft-pref + client.md + packet prose); Gemini 2.5 Flash (judge + photo VLM); gpt-4o-mini (structural extraction + Fair Housing classifier); text-embedding-3-large (all text embeddings); Jina CLIP v2 (photo embeddings)
- 6-tier vectorization recipe with hash-gated re-embed
- V2 pricing: subscription + overage ($79 Starter / $199 Pro / Enterprise custom); V1 free dogfood with full metering
- Solo agents first, brokerage later
- Anti-bug guardrails (NOT anti-user); $500/mo org budget for V1
- "Steer" banned word; Fair Housing only at packet outbound (not internal)
- All photos shown by default; quote tooltips on hover
- PII redacted but actionable
- Diarization as standalone surface
- UI layout: Home Page (top-margin agent info + folders sidebar + center search) → Client Folder page (Search / Outreach / Profile 3-surface carousel)
- Design system from V1.html preserved (mood / pace / voice / density Tweaks; default `aurora`; orb3d)

---

## 15. Update discipline

When a real change lands, update this file in the same PR:
- New env var → §8 table
- New table / enum → §5 table
- New load-bearing contract → §6 (and add test if applicable)
- New "must stay in sync" pair → §12
- New gotcha → §13 (delete superseded gotchas; this file is current state, not history)
- Plan revision → bump plan version in `docs/phase-1-plan.md` and reference here

If a section gets stale, **delete the stale bit** instead of letting it drift — wrong context is worse than missing context.
