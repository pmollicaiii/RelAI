"use client";

import { useState } from "react";

import type { MockListingCard } from "@/lib/mock-data";

interface PublicListingStackProps {
  listings: MockListingCard[];
}

function formatPrice(p: number): string {
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`;
  return `$${(p / 1000).toFixed(0)}k`;
}

type Reaction = "heart" | "dismiss" | null;

export function PublicListingStack({ listings }: PublicListingStackProps) {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});

  function setReaction(listingId: string, reaction: Reaction): void {
    setReactions((prev) => {
      const current = prev[listingId];
      const next: Reaction = current === reaction ? null : reaction;
      // TODO Week 6/11: POST /api/p/[slug]/events {kind, listingId}
      // For now this is local state only.
      const updated = { ...prev };
      if (next === null) delete updated[listingId];
      else updated[listingId] = next;
      return updated;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {listings.map((l) => (
        <article
          key={l.id}
          className={`surface rounded-2xl overflow-hidden shadow-sm transition-all ${
            reactions[l.id] === "dismiss" ? "opacity-50" : ""
          }`}
        >
          <div className="relative aspect-[16/10] bg-bg-2">
            <div className="absolute inset-0 flex items-center justify-center text-very-quiet">
              [photo placeholder]
            </div>
          </div>

          <div className="p-5 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink text-lg">{l.address}</p>
                <p className="text-sm text-quiet">
                  {l.city}, {l.state}
                </p>
              </div>
              <p className="font-serif text-2xl text-ink shrink-0">{formatPrice(l.price)}</p>
            </div>

            <p className="text-sm text-quiet">
              {l.beds} bd · {l.baths} ba · {l.sqft.toLocaleString()} sqft
            </p>

            <p className="text-base text-ink-2 mt-2 leading-relaxed">{l.oneLineWhy}</p>

            <div className="mt-4 flex items-center justify-center gap-3">
              <ReactionButton
                kind="heart"
                active={reactions[l.id] === "heart"}
                onClick={() => setReaction(l.id, "heart")}
                label="Love it"
              />
              <ReactionButton
                kind="dismiss"
                active={reactions[l.id] === "dismiss"}
                onClick={() => setReaction(l.id, "dismiss")}
                label="Not for me"
              />
              <button
                type="button"
                className="px-4 py-2.5 rounded-full text-sm text-accent bg-accent-soft hover:opacity-90 transition-opacity"
              >
                Tour this
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

interface ReactionButtonProps {
  kind: "heart" | "dismiss";
  active: boolean;
  onClick: () => void;
  label: string;
}

function ReactionButton({ kind, active, onClick, label }: ReactionButtonProps) {
  const baseClass = "px-4 py-2.5 rounded-full text-sm transition-all";
  const variantClass =
    kind === "heart"
      ? active
        ? "bg-pull/20 text-pull ring-2 ring-pull/30"
        : "bg-bg-2 text-quiet hover:bg-pull/10 hover:text-pull"
      : active
        ? "bg-push/20 text-push ring-2 ring-push/30"
        : "bg-bg-2 text-quiet hover:bg-push/10 hover:text-push";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${variantClass}`}
      aria-pressed={active}
    >
      <span className="mr-1.5">{kind === "heart" ? "♥" : "×"}</span>
      {label}
    </button>
  );
}
