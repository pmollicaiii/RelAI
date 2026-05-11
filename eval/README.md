# @relai/eval

LLM-driven golden-set evaluation harness. Runs against the prompts in
`packages/intent`, the rerank judge in `packages/rerank`, and the
packet prose composer in `packages/packet`.

## Status

V1 scaffold only. Full per-pillar golden suites populate in **Week 12** of
the build plan (`docs/phase-1-plan.md` §8 Week 12).

## How to run

```bash
pnpm eval                 # all pillars
pnpm eval -- --pillar=1   # one pillar
```

## Output

Results land at `eval/results/YYYY-MM-DD/{pillar}.json` + `summary.md`.
The `results/` directory is gitignored — only the harness + cases are
committed.

## Adding a case

1. Add a TypeScript case file to `cases/pillar-N/*.cases.ts`
2. Add a judge rubric to `judges/pillar-N-{task}.judge.ts` (for prose tasks)
3. Re-run `pnpm eval`
4. Commit the case file + the corresponding entry in
   `docs/phase-1-plan.md` if the case meaningfully changes coverage

## Discipline

Per CLAUDE.md §11 rule 10: every prompt edit must re-run the relevant
eval suite. The harness is designed to run in <60s locally so this is
cheap. CI runs it on every PR but doesn't gate until 6 weeks of baseline.
