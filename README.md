# RelAI

The autopilot real-estate agent. Software 3.0. AI-native.

**Status**: Phase 1 prototype build (12-week plan). See [`docs/phase-1-plan.md`](docs/phase-1-plan.md) for the comprehensive build plan.

**Domain**: [relai.realty](https://relai.realty)

---

## What this is

RelAI is the system that:

1. **Listens** to everything the agent learns about a client — dictation, paste, call audio, meeting audio, CRM sync — and synthesizes a queryable, editable `client.md` profile with provenance on every fact
2. **Watches** the inventory through that client's eyes — every listing represented multimodally
3. **Drives** personalized search — agent dictates a query, system returns top 20 ranked with one-line "why" explanations grounded in source quotes
4. **Composes** personalized listing packets — warm narrative tied to the client's quoted preferences, four output formats, Fair-Housing-screened before render

The wedge is the `client.md` with provenance. No competitor has it.

---

## Stack

- **Frontend**: Next.js 15 App Router on Vercel + React 19 + Tailwind v4 + shadcn/ui + Radix UI + Framer Motion + Three.js
- **Backend**: Next.js server actions + Inngest (async orchestration)
- **Database**: Neon Postgres 16 + pgvector + HNSW
- **Auth**: Clerk
- **Storage**: Cloudflare R2
- **Inference**: OpenAI (gpt-4o-mini, gpt-4o-transcribe, text-embedding-3-large) + Anthropic (Claude Sonnet 4.5) + Google (Gemini 2.5 Flash) + Replicate (Jina CLIP v2) + AssemblyAI (diarization) — all gated through `packages/inference` router
- **Observability**: Sentry + Vercel Analytics + `inference_audit` table
- **Eval**: Promptfoo (`pnpm eval` runs in <60s locally)
- **Linter/Formatter**: Biome
- **Tests**: Vitest + Playwright

---

## Local development

### Prerequisites

- Node 20+
- pnpm 10+ (`npm install -g pnpm@10`)
- A populated `apps/web/.env.local` (copy from root `.env.example`)

### First-time setup

```bash
pnpm install
pnpm --filter @relai/db db:migrate    # runs once vendor accounts are wired
pnpm dev                              # starts Next.js dev server on :3000
```

### Common commands

```bash
pnpm dev          # start dev (Turbo runs apps/web)
pnpm build        # production build
pnpm test         # unit tests (Vitest)
pnpm typecheck    # TypeScript check across all packages
pnpm lint         # Biome lint
pnpm format       # Biome format
pnpm eval         # run LLM eval suites (Promptfoo)
```

---

## Repository layout

```
apps/
  web/                Next.js 15 — the whole UI + server actions
packages/
  inference/          Router + cache + audit + PII gate + retry + A/B
  embedding/          Recipe + cosine + hash gate
  pii/                redactListingPii + redactContactPii
  intent/             5-pass extraction prompts + types
  rerank/             Judge pass + centroid math (positive + avoidance)
  packet/             Composition + Fair Housing gate + format renderers
  ontology/           Soft-pref slug definitions + LLM-pending workflow
  db/                 Drizzle schema + migrations
eval/                 Promptfoo harness + golden sets per pillar
docs/                 phase-1-plan.md + ADRs + reference docs
```

---

## Architecture principles

See [`docs/phase-1-plan.md`](docs/phase-1-plan.md) for the comprehensive plan. Key principles:

- **LLM as runtime** — inference at every inflection point. No bolt-on chatbot.
- **Autonomy slider** — every AI-inferred fact is visible and editable. Start at full human review; slide toward autonomy per-task as evals prove reliability.
- **Provenance everywhere** — every soft pref → source artifact + timestamp + quote.
- **Search drives the filter; client.md only re-ranks** — a long-standing client's flavor never overpowers a fresh search intent.
- **Multi-model routing** — small models for cheap structural tasks, big models for nuance. The `packages/inference` router is the single chokepoint.
- **Cache aggressively** — hash-gate every deterministic inference.
- **Evals as first-class** — every prompt ships with ≥5 golden cases. No prompt change without re-running.
- **No raw SDK calls** — all inference goes through the router.

---

## Process discipline

1. No milestone ships without a demo a non-developer can react to.
2. No backend capability ships ahead of the UI that consumes it.
3. One feature at a time, fully through to UI.
4. The plan doc narrows scope, never widens.
5. Documentation reflects current state, not history.
6. The word "steer" is banned everywhere.

---

## Archive

The previous codebase (M0 → M19 build) is preserved as a read-only reference at `github.com/pmollicaiii/RelAI-Archive` (private). Tagged at `pre-reset-2026-05-10`.
