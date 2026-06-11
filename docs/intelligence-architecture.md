# RelAI Intelligence Architecture

**Status:** living reference. Drafted 2026-06-11 after the embedding pipeline went live.
**Companions:** [`phase-1-plan.md`](phase-1-plan.md) (the locked build plan; §9 model research, §19 decision audit trail) and `CLAUDE.md` §6 (load-bearing contracts).

This document answers three questions:

1. Where does intelligence live in the app? (every touchpoint)
2. Which model serves each touchpoint, and why?
3. How does the system improve itself over time? (the flywheel plan)

---

## 1. The shape of intelligence in RelAI

Three distinct kinds of "intelligence" exist in the system, and they improve through different mechanisms:

| Kind | Lives in | Improves via |
|---|---|---|
| **Inference touchpoints** — every LLM / embedding / STT / vision call | `packages/inference` router (21 task kinds, single `infer()` chokepoint) | Prompt iteration, model A/B promotion, routing changes |
| **Learned state** — per-client taste math | Postgres: soft-pref weights, two centroids, `client.md` | Reaction signals; no model retraining — *the UI is the math* |
| **Shared vocabulary** — the soft-pref ontology | `soft_pref_slugs` (145 slugs) + `soft_pref_pending` | Real client language graduating through the 3-occurrence gate |

The single most important architectural property: **everything flows through `infer()`** (CLAUDE.md §6.7). That chokepoint is what makes the improvement loops in §4 possible — every call can be audited, cached, A/B-split, cost-capped, PII-gated, and quality-scored in one place. No raw SDK calls exist outside `packages/inference` (Biome-enforced).

---

## 2. Touchpoint inventory — all 21 task kinds

Status legend: **LIVE** (real vendor wired) · **mock** (full pipeline runs, mock output until vendor handler lands) · **blocked** (external dependency).

### Pillar 1 — Listing understanding (runs per listing, ~6.2k today, batch-friendly)

| Task kind | What it does | Model | ~$/call | Status |
|---|---|---|---|---|
| `embed_listing_description` | Recipe text → 3072-dim vector | `openai/text-embedding-3-large` | $0.00004 | **LIVE** |
| `essence_doc_generate` | Facts + remarks + tags → structured "essence" markdown (what this home *is like*) | `anthropic/claude-sonnet-4-5` (challenger `google/gemini-2.5-pro` @10%) | $0.006 | mock |
| `embed_listing_essence` | Essence doc → 3072-dim vector | `openai/text-embedding-3-large` | $0.00015 | mock |
| `photo_characterize` | Photo → room type, condition signals, features, lighting | `google/gemini-2.5-flash` (challenger Sonnet @10%) | $0.0008 | **blocked** — Bright CSVs ship no photo URLs; unblocks with Bright API access |
| `photo_embed` | Photo → 1024-dim CLIP vector | `replicate/jina-clip-v2` | $0.0003 | **blocked** — same |

### Pillar 2 — Client intake (runs per intake source: call audio, emails, texts, dictation)

| Task kind | What it does | Model | ~$/call | Status |
|---|---|---|---|---|
| `transcribe_audio` | Audio → transcript | `openai/gpt-4o-transcribe` (challenger `assemblyai/universal-2` @10%) | $0.06 | mock |
| `diarize_audio` | Audio → speaker-labelled segments | `assemblyai/universal-2` | $0.06 | mock |
| `extract_parties` | Pass 1: who is in this household | `openai/gpt-4o-mini` | $0.0001 | mock |
| `extract_hard_constraints` | Pass 2: budget / beds / areas / dealbreakers | `openai/gpt-4o-mini` | $0.0003 | mock |
| `extract_soft_preferences` | Pass 3: taste statements, ontology-grounded | `anthropic/claude-sonnet-4-5` (challenger `gpt-4o` @10%) | $0.008 | mock |
| `extract_contradictions` | Pass 4: new info vs existing state | `openai/gpt-4o-mini` | $0.0003 | mock |
| `extract_gaps` | Pass 5: what we still don't know | `openai/gpt-4o-mini` | $0.0003 | mock |
| `embed_soft_pref_statement` | Soft-pref display label → 3072-dim vector | `openai/text-embedding-3-large` | $0.00005 | mock |
| `curate_client_md` | All facets → the human-readable `client.md` | `anthropic/claude-sonnet-4-5` (challenger Gemini 2.5 Pro @10%) | $0.015 | mock |

### Pillar 3 — Personalized search (runs per search; the hot path)

| Task kind | What it does | Model | ~$/call | Status |
|---|---|---|---|---|
| `parse_search_query` | NL query → hard filter + soft prefs | `openai/gpt-4o-mini` + Sonnet for the soft-pref portion | $0.003 | mock |
| `embed_search_query` | Query text → 3072-dim vector | `openai/text-embedding-3-large` | $0.00005 | mock |
| `judge_listing_fit` | Top-20 candidates × (client.md + essence + query) → fit score + one-line why + flags | `google/gemini-2.5-flash` (challenger Sonnet @10%) | $0.0005 | mock |
| `map_soft_pref_to_ontology` | Free-text taste phrase → existing slug or propose-new | `openai/gpt-4o-mini` | $0.0002 | mock |

### Pillar 4 — Packets (runs per packet; outbound = highest stakes)

| Task kind | What it does | Model | ~$/call | Status |
|---|---|---|---|---|
| `packet_hero_prose` | Per-listing personalized paragraph citing the client's own words | `anthropic/claude-sonnet-4-5` (challenger Gemini 2.5 Pro @10%) | $0.018 | mock |
| `packet_sms_compress` | Hero paragraph → SMS-length | `openai/gpt-4o-mini` | $0.0001 | mock |
| `fair_housing_screen_outbound` | Final outbound text → FH flag check | `openai/gpt-4o-mini` | $0.0005 | mock |

### Non-LLM intelligence (math + rules; no inference cost)

| System | Lives in | Role |
|---|---|---|
| Two-centroid taste vectors (positive + avoidance) | `packages/rerank/centroid.ts` | Weighted mean of soft-pref embeddings by `(weight × confidence)`; recomputed on demand; reranks every search |
| Heuristic + semantic blend | `packages/rerank` | `final = (1−w)·heuristic + w·semantic`; deterministic, inspectable |
| Hash gates | `packages/embedding/hash.ts` | `source_text_hash` makes every re-embed / re-extract idempotent and cheap |
| Fair Housing keyword screen | `packages/packet/fair-housing/` | Deterministic floor that runs BEFORE the LLM screen; the LLM is additive, never a replacement |
| PII redaction gate | `packages/pii` via `applyPiiGate` | Strips identity, keeps intent, before every vendor call with `redactPii: true` |
| Inference cache | `packages/inference/cache.ts` | Content-hash LRU; embeddings + structural extraction cached up to 1y |

---

## 3. Model assignments — the why

The router assigns models **by role**, not by vendor loyalty. Four lanes:

**Lane 1 — One embedding space (`text-embedding-3-large`, 3072-dim).**
Every text embedding in the system — listing descriptions, essence docs, soft-pref labels, search queries — uses the same model, because cosine similarity across vectors from different models is meaningless. The client's taste centroid must live in the *same space* as the listing vectors it ranks. This is load-bearing: changing the embedding model is a full-corpus re-embed (hash-gated, ~$0.20, but a deliberate ops act), never a partial swap. Cost is trivial ($0.13/1M tokens); 3072 dims chosen for headroom on nuanced taste distinctions.

**Lane 2 — Taste-bearing prose (Claude Sonnet).**
`essence_doc_generate`, `extract_soft_preferences`, `curate_client_md`, `packet_hero_prose` — the four surfaces where *quality of judgment about people and homes* is the product. These need: nuance (the difference between "wants charm" and "fears sterile"), faithful quoting (packets cite the buyer's own words), and a voice that doesn't sound like AI slop in front of a client. Claude is strongest here per the plan's research; each carries a 10% challenger (Gemini 2.5 Pro or GPT-4o) so we accumulate comparison data from day one.

*Refresh note (2026-06-11):* the router pins `claude-sonnet-4-5`, which is now a legacy model. Current is **Claude Sonnet 4.6** (`claude-sonnet-4-6`, $3/$15 per MTok — same price, 1M context, adaptive thinking instead of `budget_tokens`). Recommendation: bump in the same PR that wires the Anthropic vendor handler — it's a router-string change plus eval re-baseline, and writing the handler against the current API (adaptive thinking) avoids building against a deprecated parameter shape. **Claude Haiku 4.5** ($1/$5) is also worth registering as a challenger on the structural-extraction lane (vs gpt-4o-mini) once evals exist to judge the swap.

**Lane 3 — High-volume cheap structure (gpt-4o-mini).**
The 5-pass extraction's structural passes, query parsing, ontology mapping, SMS compression, FH classification. These are JSON-shaped, low-ambiguity, high-frequency. The cheapest model that reliably emits valid structured output wins; quality differences between frontier models on "extract beds/baths/budget" are negligible while cost differences are 30×.

**Lane 4 — Vision + judge scale (Gemini 2.5 Flash, Jina CLIP v2).**
`judge_listing_fit` runs 20× per search — it's the single highest-volume LLM call in the system (`dailyCallCap: 200_000`). Flash is the cheapest model capable of holding a client profile + listing essence and producing a calibrated score. Photo characterization (when unblocked) shares Flash for the same per-photo economics. Jina CLIP v2 gives a shared image↔text space at 1024 dims for "find homes that look like this".

**Cross-cutting cost levers already designed into the router:**
- `batchEligible: true` on all corpus-scale tasks → 50% off via OpenAI/Anthropic batch APIs when `urgency: 'background'` (dispatch wiring pending).
- `cacheable` + content-hash caching → repeated judge calls on unchanged (folder, listing) pairs are free.
- Prompt caching (vendor-side) is the big untapped lever for the judge pass: the client.md + system prompt is a shared prefix across all 20 judge calls per search; Anthropic/Gemini cache reads cost ~0.1×. Wire when the judge handler lands.
- `dailyCallCap` per task + the $500/mo org budget are anti-bug guardrails (a runaway loop hits the cap, not the credit card).

---

## 4. The flywheel — how the system improves itself

Three layers of learning, at three timescales:

```
L1  Per-folder taste        minutes   reactions → weights/centroids → next search reranks
L2  Per-corpus vocabulary   days      unmapped phrases → pending gate → ontology grows
L3  Per-task model quality  weeks     audit + scores + evals → prompt/model promotion
```

The keystone is the **audit spine**: `inference_audit` (per-call: task, model, variant, prompt hash, tokens, cost, latency, status) + `inference_quality_scores` (per-audit-row: score source, 0–1 score, rubric). Both tables exist in the schema today; **the write in `infer()` is still a no-op TODO**. Nothing in L3 can close until that write is on — it is the first build item in §5.

### Loop 1 — Taste (L1, the product's core loop)

**Signal → store → consumer → closes when:** agent saves/hides/favorites a listing, or a buyer reacts through a packet link → `client_reactions` (two streams: `agent` and `buyer`, with `source` + `polarity` + links back to the search/packet that produced the exposure) → soft-pref weight updates + centroid recompute → the next search reranks differently → which produces new reactions.

Design properties that keep it honest (already locked):
- Provenance on every preference (who said it, where, when) — corrections are possible because nothing is a black box.
- Two centroids, not one: avoidance is its own vector, not a negative weight. "Hates carpet" must repel, not merely fail to attract.
- Buyer-stream reactions outrank agent-stream inferences when they conflict (the buyer is the ground truth).
- Decay: stale signals lose weight so a folder's taste tracks the client's *current* search, not their March self.

### Loop 2 — Judge calibration (L3; the highest-value new loop)

Every search stores both the judge's opinion (`search_judgments`: fit score, one-line why, tied preferences, model, cache key) and, over the following hours/days, the humans' opinion (`client_reactions` on the same folder+listing). That pairing is **free labelled data**:

- **Agreement metric:** of listings the judge scored ≥0.8, what fraction got saved/favorited? Of listings it flagged, what fraction got hidden? Rolled up nightly (Inngest cron) per model variant → written to `inference_quality_scores` with `score_source: 'implicit-reaction'`.
- **Disagreement mining:** the judge said 0.9, the client hid it (or vice versa) → those cases are exported into the eval golden set. The eval suite grows from real failures, not invented ones.
- This is also the **primary vs challenger scoreboard** for the judge: same metric, split by `model_variant`, answers "is Sonnet actually better than Flash here, and by how much per dollar?"

### Loop 3 — Ontology growth (L2)

`extract_soft_preferences` / `map_soft_pref_to_ontology` encounter a taste phrase with no slug → proposed into `soft_pref_pending` with the source quote → the 3-occurrence gate (same phrase from 3 distinct sources) promotes it to admin review → approval creates the slug, embeds its display label, and it becomes available to Smart Control chips, search parsing, and centroid math. The vocabulary the system thinks in is grown from what real clients actually say — with a human gate so the ontology never silently drifts.

### Loop 4 — Challenger promotion (L3)

Already half-built: `pickVariant()` deterministically routes N% of calls to the challenger (deterministic by prompt hash, so retries don't flip variants), and `model_variant` lands in the audit row. What closes the loop:

1. Quality scores accumulate per variant (from Loop 2's implicit metric, golden evals, and spot-check human review).
2. A **weekly model review** (manual, 15 minutes): one query over `inference_audit ⋈ inference_quality_scores` grouped by (task, variant) — quality, cost, latency side by side.
3. Promotion = edit `modelPrimary` in `router.ts` + note in CLAUDE.md. Manual in V1 by locked decision (§19) — no auto-promotion until the metrics have months of credibility.

### Loop 5 — Eval regression harness (L3)

`eval/` (Promptfoo, `pnpm eval`, <60s local) holds golden sets per pillar: intent-extraction cases (transcript → expected facets), judge cases (profile + listing → expected fit band), FH-screen cases (text → expected flags), packet-prose cases (LLM-judged against a rubric). Two feeds keep it alive:
- Every Loop-2 disagreement and every production incident becomes a case.
- Every prompt edit, model bump, or recipe change must pass the suite before merge (non-gating in CI today; gating once the suite has earned trust).

### Loop 6 — Packet engagement (L1 + L3)

`packet_events` (opens, per-listing views, lingers — captured from the public packet link with ip-hash/UA, no auth) feeds two places: per-listing engagement becomes buyer-stream reactions (→ Loop 1), and packet-level open/response rates become the outcome metric for `packet_hero_prose` A/B (→ Loop 4). Later: agent edits to generated prose are the highest-signal critique of the prose model we can collect (the archive's style-learning concept) — capture the edit diff, even before we build anything that consumes it.

### Loop 7 — Cost & latency (ops)

`inference_audit` rollups by task/day → spot the drift (a prompt change doubled judge tokens; cache hit-rate fell after a recipe bump) → tune router config: cache TTLs, batch dispatch, challenger pct, model downgrades where Loop-2/5 metrics say quality holds. The admin cost dashboard reads these local tables (no external analytics dependency).

### Guardrails — so the loops can't hurt us

- **No silent learning:** every weight change is provenance-stamped and surfaced in the UI (ledger + Smart Control). The user can always see *why* the ranking moved.
- **Shadow before live** (archive lesson): when a new ranking ingredient lands (e.g. judge scores entering the blend), compute it alongside the live ranking and log the diff before it affects what the agent sees.
- **Fair Housing floor is deterministic:** the keyword screen always runs; the LLM screen can only ADD flags, never clear them. Loops never touch this.
- **PII gate before every vendor call** — improvement data never includes who the client is.
- **Caps everywhere:** per-task daily call caps, $500/mo org budget, eval gate on prompt/model changes.

---

## 5. Build plan for the loops

Sequenced to ride the existing Phase-1 pillar schedule — each loop lands with the pillar that produces its signal, not as a separate project.

| Phase | Scope | Builds | Effort |
|---|---|---|---|
| **A. Audit spine** (next inference PR) | Turn on `inference_audit` writes in `infer()` (fire-and-forget, never blocks the call); `recordQualityScore()` helper; backfill meta (tokens/cost) already flows from the embed handler | The keystone — nothing in L3 works without it | Small (1 PR) |
| **B. Taste loop** (with Pillar 3 build) | `client_reactions` write paths (save/hide/favorite UI → server action), centroid recompute on reaction, decay | Loop 1 live | Already on the plan; this just names it |
| **C. Judge calibration** (right after first real searches) | Nightly Inngest cron: judgments ⋈ reactions agreement rollup → `inference_quality_scores`; disagreement export to `eval/cases/` | Loops 2 + 5 seeded with real data | Medium (1–2 PRs) |
| **D. Eval golden sets** (Week 5–6 per plan) | 5–10 cases per task family (intent, judge, FH, prose-rubric); `pnpm eval` wired into CI non-gating | Loop 5 operational | Medium |
| **E. Review ritual** (once C+D emit data) | The weekly (task, variant) quality/cost/latency query + a one-page promotion playbook in docs/ | Loop 4 closes | Tiny — it's a query + a habit |
| **F. Post-V1** | LLM-judge auto-scoring of sampled prod outputs (`score_source: 'llm-judge'`), packet edit-diff capture, drift alarms, auto-promotion *proposals* (human still approves) | Loops 6-deep + 7 mature | Later |

What stays **manual in V1** (locked decisions, unchanged): challenger promotion, ontology approval, ranking-weight changes. The loops *surface* the evidence; a human turns the dial.

---

## 6. Open decisions (tracked)

1. **Sonnet 4.5 → 4.6 bump** — recommended at Anthropic-vendor-wiring time (same PR), since the handler should be written against adaptive thinking (the 4.6 API), not the deprecated `budget_tokens` shape. *(Decision pending.)*
2. **Phase-A-first sequencing** — audit writes before any further vendor handlers, so every real call from day one is in the ledger. *(Decision pending.)*
3. **V1 quality-score sources** — golden evals + implicit reaction metric only (free, automatic), vs also LLM-judge sampling of prod outputs (richer but adds cost/complexity). Recommendation: defer LLM-judge scoring to Phase F; the implicit metric is the one that can't be gamed. *(Decision pending.)*
