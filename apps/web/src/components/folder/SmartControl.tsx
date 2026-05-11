"use client";

import { useState } from "react";

import type { MockSoftPrefChip } from "@/lib/mock-data";

interface SmartControlProps {
  chips: MockSoftPrefChip[];
  onChipToggle?: (chipId: string, active: boolean) => void;
  onChipDelete?: (chipId: string) => void;
  onChipWeightChange?: (chipId: string, weight: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  interior_features: "Interior",
  layout: "Layout",
  interior_style: "Style",
  architectural_style: "Architecture",
  exterior_features: "Exterior",
  lifestyle_location: "Lifestyle",
  condition: "Condition",
  amenities: "Amenities",
  practical: "Practical",
  avoidance_specific: "Avoidance",
};

export function SmartControl({
  chips,
  onChipToggle,
  onChipDelete,
  onChipWeightChange,
}: SmartControlProps) {
  const [showHidden, setShowHidden] = useState(false);

  const positive = chips.filter((c) => c.polarity === "positive");
  const negative = chips.filter((c) => c.polarity === "negative");

  const groupByCategory = (list: MockSoftPrefChip[]): Map<string, MockSoftPrefChip[]> => {
    const m = new Map<string, MockSoftPrefChip[]>();
    for (const c of list) {
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return m;
  };

  return (
    <aside
      className="w-80 border-l border-line bg-bg-2/30 flex flex-col h-full overflow-y-auto"
      aria-label="Smart Control"
    >
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-serif italic text-2xl text-ink">Smart Control</h2>
        <p className="text-xs text-quiet mt-1">
          What the model parsed from this folder. Edit chips → centroids update → next search
          reranks.
        </p>
      </div>

      <ChipSection title="Pull factors" subtitle="green = positive">
        {[...groupByCategory(positive).entries()].map(([cat, list]) => (
          <ChipGroup key={cat} title={CATEGORY_LABELS[cat] ?? cat}>
            {list.map((c) => (
              <Chip
                key={c.id}
                chip={c}
                onToggle={(active) => onChipToggle?.(c.id, active)}
                onDelete={() => onChipDelete?.(c.id)}
                onWeightChange={(w) => onChipWeightChange?.(c.id, w)}
              />
            ))}
          </ChipGroup>
        ))}
        {positive.length === 0 && (
          <p className="text-very-quiet text-xs px-1 py-2">
            No positive chips yet. Add a source on the Profile surface.
          </p>
        )}
      </ChipSection>

      <ChipSection title="Push factors" subtitle="red = avoidance">
        {[...groupByCategory(negative).entries()].map(([cat, list]) => (
          <ChipGroup key={cat} title={CATEGORY_LABELS[cat] ?? cat}>
            {list.map((c) => (
              <Chip
                key={c.id}
                chip={c}
                onToggle={(active) => onChipToggle?.(c.id, active)}
                onDelete={() => onChipDelete?.(c.id)}
                onWeightChange={(w) => onChipWeightChange?.(c.id, w)}
              />
            ))}
          </ChipGroup>
        ))}
        {negative.length === 0 && (
          <p className="text-very-quiet text-xs px-1 py-2">No avoidance chips yet.</p>
        )}
      </ChipSection>

      <div className="px-5 py-3 border-t border-line mt-auto">
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="text-xs text-quiet hover:text-ink transition-colors"
        >
          {showHidden ? "hide" : "show"} dismissed
        </button>
      </div>
    </aside>
  );
}

interface ChipSectionProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ChipSection({ title, subtitle, children }: ChipSectionProps) {
  return (
    <section className="px-5 py-4 border-b border-line">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <span className="text-xs text-very-quiet">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

interface ChipGroupProps {
  title: string;
  children: React.ReactNode;
}

function ChipGroup({ title, children }: ChipGroupProps) {
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <p className="text-xs uppercase tracking-wider text-very-quiet">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

interface ChipProps {
  chip: MockSoftPrefChip;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  onWeightChange: (w: number) => void;
}

function Chip({ chip, onToggle: _onToggle, onDelete, onWeightChange: _onWeightChange }: ChipProps) {
  const cls = chip.polarity === "positive" ? "chip-pull" : "chip-push";
  return (
    <span
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${cls}`}
      title={`"${chip.sourceQuote}"`}
    >
      <span>{chip.displayLabel}</span>
      <span className="font-mono text-[10px] opacity-70">
        {chip.polarity === "negative" ? "-" : ""}
        {chip.weight.toFixed(2)}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        ×
      </button>
    </span>
  );
}
