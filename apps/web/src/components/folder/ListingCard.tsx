"use client";

import { useState } from "react";

import { formatNumber, formatPrice } from "@/lib/format";
import type { MockListingCard } from "@/lib/mock-data";

interface ListingCardProps {
  listing: MockListingCard;
  rank: number;
  onThumb?: (listingId: string, direction: "up" | "down") => void;
  onAddToPacket?: (listingId: string) => void;
}

export function ListingCard({ listing, rank, onThumb, onAddToPacket }: ListingCardProps) {
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);

  function setVote(direction: "up" | "down"): void {
    const next = thumb === direction ? null : direction;
    setThumb(next);
    if (next !== null) onThumb?.(listing.id, next);
  }

  return (
    <article
      className={`surface rounded-xl overflow-hidden hover:shadow-md transition-shadow ${
        thumb === "up"
          ? "ring-2 ring-pull/30"
          : thumb === "down"
            ? "ring-2 ring-push/30 opacity-70"
            : ""
      }`}
    >
      <div className="relative aspect-[16/9] bg-bg-2 overflow-hidden">
        {/* TODO Week 3 when photos arrive: real img with next/image */}
        <div className="absolute inset-0 flex items-center justify-center text-very-quiet text-sm">
          [photo placeholder]
        </div>
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-mono bg-card/90 text-ink-2">
          #{rank}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono bg-card/90 text-ink-2">
          {(listing.fitScore * 100).toFixed(0)}%
        </span>
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-ink truncate">{listing.address}</p>
            <p className="text-xs text-quiet truncate">
              {listing.city}, {listing.state}
            </p>
          </div>
          <p className="font-mono text-sm text-ink shrink-0">{formatPrice(listing.price)}</p>
        </div>

        <p className="text-xs text-very-quiet">
          {listing.beds} bd · {listing.baths} ba · {formatNumber(listing.sqft)} sqft
        </p>

        <p className="text-sm text-ink-2 mt-1 leading-relaxed line-clamp-2">{listing.oneLineWhy}</p>

        <div className="flex items-center gap-1 mt-2">
          <button
            type="button"
            onClick={() => setVote("up")}
            className={`px-2 py-1 rounded text-sm transition-colors ${
              thumb === "up" ? "bg-pull/20 text-pull" : "text-quiet hover:text-ink hover:bg-bg-2"
            }`}
            aria-label="Thumbs up"
            aria-pressed={thumb === "up"}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => setVote("down")}
            className={`px-2 py-1 rounded text-sm transition-colors ${
              thumb === "down" ? "bg-push/20 text-push" : "text-quiet hover:text-ink hover:bg-bg-2"
            }`}
            aria-label="Thumbs down"
            aria-pressed={thumb === "down"}
          >
            👎
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onAddToPacket?.(listing.id)}
            className="px-2.5 py-1 rounded text-xs font-medium text-accent hover:bg-accent-soft transition-colors"
          >
            → packet
          </button>
        </div>
      </div>
    </article>
  );
}
