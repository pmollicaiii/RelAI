/**
 * @relai/eval — runner for LLM-driven golden-set evaluations.
 *
 * V1 scaffold: prints summary + skeleton results. Full per-pillar suites
 * populated in Week 12 of the build plan (see docs/phase-1-plan.md §8 Week 12).
 *
 * Usage:
 *   pnpm eval               # runs all pillars
 *   pnpm eval -- --pillar=1 # runs one pillar
 *
 * Output:
 *   eval/results/YYYY-MM-DD/{pillar}.json
 *   eval/results/YYYY-MM-DD/summary.md
 *
 * CI: GitHub Actions runs `pnpm eval` non-gating until 6 weeks of baseline
 * data accumulates. After that, gating turns on per-pillar.
 */

/* eslint-disable no-console */

interface PillarResult {
  pillar: 1 | 2 | 3 | 4;
  name: string;
  casesRun: number;
  passed: number;
  failed: number;
  skipped: number;
  meanQuality: number; // 0-1
}

const PILLARS: Array<Omit<PillarResult, "casesRun" | "passed" | "failed" | "skipped" | "meanQuality">> = [
  { pillar: 1, name: "Multimodal listing understanding" },
  { pillar: 2, name: "Client vector with provenance" },
  { pillar: 3, name: "Personalized search" },
  { pillar: 4, name: "Personalized packets" },
];

async function runPillar(p: (typeof PILLARS)[number]): Promise<PillarResult> {
  // TODO Week 12: load golden cases for this pillar + run via @relai/inference
  //               router + score against rubrics (LLM-as-judge for prose).
  return {
    ...p,
    casesRun: 0,
    passed: 0,
    failed: 0,
    skipped: 5, // pretend there are 5 cases skipped per pillar
    meanQuality: 0,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pillarFlag = args.find((a) => a.startsWith("--pillar="));
  const targetPillar = pillarFlag ? Number(pillarFlag.split("=")[1]) : null;

  const toRun = targetPillar
    ? PILLARS.filter((p) => p.pillar === targetPillar)
    : PILLARS;

  console.log(`[@relai/eval] Running ${toRun.length} pillar suite(s)...`);
  const results: PillarResult[] = [];
  for (const p of toRun) {
    const r = await runPillar(p);
    results.push(r);
    console.log(
      `  Pillar ${r.pillar} (${r.name}): ` +
        `${r.passed}/${r.casesRun} passed, ${r.skipped} skipped (mean quality ${r.meanQuality.toFixed(2)})`,
    );
  }

  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalRun = results.reduce((s, r) => s + r.casesRun, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

  console.log(`[@relai/eval] Done. ${totalPassed}/${totalRun} passed, ${totalSkipped} skipped.`);
  console.log("[@relai/eval] (Skeleton run — Week 12 populates golden cases per pillar.)");
}

main().catch((err) => {
  console.error("[@relai/eval] FAILED:", err);
  process.exit(1);
});
