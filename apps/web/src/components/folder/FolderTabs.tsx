"use client";

import { useState } from "react";

import { MOCK_CHIPS, MOCK_LISTINGS, type MockFolder } from "@/lib/mock-data";
import { ListingCard } from "./ListingCard";
import { SmartControl } from "./SmartControl";

type Surface = "search" | "outreach" | "profile";

interface FolderTabsProps {
  folder: MockFolder;
  initialSurface?: Surface;
}

const SURFACES: { id: Surface; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "outreach", label: "Outreach" },
  { id: "profile", label: "Profile" },
];

export function FolderTabs({ folder, initialSurface = "search" }: FolderTabsProps) {
  const [surface, setSurface] = useState<Surface>(initialSurface);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="px-6 pt-4 pb-3 border-b border-line bg-bg/60 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl text-ink tracking-tight">{folder.displayName}</h1>
          <p className="text-xs text-very-quiet">{folder.shorthand}</p>
        </div>
        <nav className="flex gap-1" aria-label="Folder surface">
          {SURFACES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSurface(s.id)}
              className={`px-4 py-2 rounded-md text-sm transition-colors ${
                surface === s.id
                  ? "bg-accent text-white font-medium"
                  : "text-ink-2 hover:bg-bg-2 hover:text-ink"
              }`}
              aria-current={surface === s.id ? "page" : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {surface === "search" && <SearchSurface folder={folder} />}
      {surface === "outreach" && <OutreachSurface folder={folder} />}
      {surface === "profile" && <ProfileSurface folder={folder} />}
    </div>
  );
}

// ============================================================================
// Search surface
// ============================================================================

function SearchSurface({ folder }: { folder: MockFolder }) {
  // TODO Week 5: load real search results from Drizzle / server action
  const [showAll, setShowAll] = useState(false);
  const top20 = MOCK_LISTINGS.slice(0, 5); // mock data has only 5; in production this is top 20
  const totalCandidates = 247;
  const remaining = totalCandidates - top20.length;
  void folder;

  function handleThumb(listingId: string, direction: "up" | "down"): void {
    console.log("[SearchSurface] thumb", { listingId, direction });
  }
  function handleAddToPacket(listingId: string): void {
    console.log("[SearchSurface] add to packet", { listingId });
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex items-center gap-2 text-xs text-quiet flex-wrap">
          <span className="font-medium text-ink-2">Hard prefs:</span>
          <span className="px-2 py-0.5 rounded bg-bg-2 text-ink-2">budget ≤ $850k</span>
          <span className="px-2 py-0.5 rounded bg-bg-2 text-ink-2">beds ≥ 4</span>
          <span className="px-2 py-0.5 rounded bg-bg-2 text-ink-2">Lower Merion area</span>
        </div>

        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink">
            Top {top20.length} ranked
            <span className="text-very-quiet font-normal"> of {totalCandidates} matching</span>
          </h2>
          <p className="text-xs text-very-quiet">streamed by Gemini 2.5 Flash judge pass</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {top20.map((l, i) => (
            <ListingCard
              key={l.id}
              listing={l}
              rank={i + 1}
              onThumb={handleThumb}
              onAddToPacket={handleAddToPacket}
            />
          ))}
        </div>

        {!showAll && remaining > 0 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm text-accent hover:underline"
            >
              View all {totalCandidates} matching listings →
            </button>
          </div>
        )}
        {showAll && (
          <p className="mt-6 text-center text-xs text-very-quiet">
            (Full candidate set rendering wires in Week 5.)
          </p>
        )}
      </div>

      <SmartControl chips={MOCK_CHIPS} />
    </div>
  );
}

// ============================================================================
// Outreach surface
// ============================================================================

function OutreachSurface({ folder }: { folder: MockFolder }) {
  void folder;
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 max-w-4xl">
      <h2 className="font-serif text-2xl text-ink mb-1">Outreach timeline</h2>
      <p className="text-quiet text-sm mb-6">
        Every SMS, email, PDF, and public link sent for this client. Click any item to expand.
      </p>

      <ul className="flex flex-col gap-3">
        <OutreachItem
          when="Mon 4:30 PM"
          kind="Packet (web link)"
          summary="3 listings shared — opened 4x by buyer; 2 hearts so far"
        />
        <OutreachItem
          when="Sun 11 AM"
          kind="SMS"
          summary="1 listing teaser — link opened on mobile"
        />
        <OutreachItem
          when="Sat 2 PM"
          kind="Email"
          summary="5 listings — opened 2x; one tour requested (123 Oak St)"
        />
        <OutreachItem
          when="Fri 9 AM"
          kind="PDF (email attachment)"
          summary="Initial 4-listing recap"
        />
      </ul>
    </div>
  );
}

function OutreachItem({ when, kind, summary }: { when: string; kind: string; summary: string }) {
  return (
    <li className="surface rounded-lg px-4 py-3 flex flex-col gap-1 hover:shadow-sm transition-shadow">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-mono text-very-quiet">{when}</span>
        <span className="text-xs text-accent">[view]</span>
      </div>
      <p className="font-medium text-sm text-ink">{kind}</p>
      <p className="text-xs text-quiet">{summary}</p>
    </li>
  );
}

// ============================================================================
// Profile surface — client.md with provenance
// ============================================================================

function ProfileSurface({ folder }: { folder: MockFolder }) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 max-w-4xl">
      <h2 className="font-serif text-2xl text-ink mb-1">{folder.displayName}</h2>
      <p className="text-quiet text-sm mb-6">
        Distilled from every intake source. Click any inferred fact to see the source quote.
      </p>

      <div className="surface rounded-lg p-6 mb-6">
        <h3 className="font-medium text-sm text-ink-2 uppercase tracking-wider mb-3">
          Hard constraints
        </h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          <FactRow
            label="Budget"
            value="$750k – $850k"
            quote="we're capped at 850 but really want under 800"
          />
          <FactRow
            label="Beds"
            value="4+"
            quote="four bedrooms minimum, two kids and a guest room"
          />
          <FactRow
            label="Location"
            value="Lower Merion area"
            quote="Lower Merion district is the priority"
          />
        </ul>
      </div>

      <div className="surface rounded-lg p-6 mb-6">
        <h3 className="font-medium text-sm text-ink-2 uppercase tracking-wider mb-3">
          Soft preferences
        </h3>
        <p className="text-xs text-very-quiet mb-3">
          See the Smart Control panel (Search surface) for live editable chips with weights.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          <FactRow
            label="Quiet home office"
            value="weight 0.9 (positive)"
            quote="I do all my calls from home so noise kills me"
          />
          <FactRow
            label="Open floor plan"
            value="weight 0.85 (positive)"
            quote="we love how the kitchen and great room flow"
          />
          <FactRow
            label="Natural light"
            value="weight 0.7 (positive)"
            quote="natural light is huge for us"
          />
        </ul>
      </div>

      <div className="surface rounded-lg p-6 mb-6">
        <h3 className="font-medium text-sm text-ink-2 uppercase tracking-wider mb-3">
          Life context
        </h3>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
          <li>Timeline: move-in by September (for school)</li>
          <li>Household: 2 adults, 2 kids, 1 dog</li>
          <li>Work: husband WFH, commute optional</li>
        </ul>
      </div>

      <div className="surface rounded-lg p-6 border-accent-soft bg-accent-soft/50">
        <h3 className="font-medium text-sm text-accent uppercase tracking-wider mb-3">
          You didn&apos;t ask about
        </h3>
        <ul className="flex flex-col gap-2 text-sm">
          <GapRow
            topic="Commute"
            question="Where do the adults commute to on a typical day?"
            why="Drives the location filter weight."
          />
          <GapRow
            topic="HOA tolerance"
            question="Are you OK with an HOA up to $X/mo, or strictly no-HOA?"
            why="Roughly half of Lower Merion inventory has HOA fees."
          />
        </ul>
      </div>
    </div>
  );
}

function FactRow({ label, value, quote }: { label: string; value: string; quote: string }) {
  return (
    <li className="group flex items-baseline justify-between gap-3 py-1 hover:bg-bg-2/50 -mx-2 px-2 rounded transition-colors">
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="text-quiet shrink-0">{label}:</span>
        <span className="text-ink font-medium">{value}</span>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-very-quiet hover:text-accent text-xs"
          aria-label="Edit"
        >
          ✎
        </button>
      </div>
      <span
        className="text-xs italic text-very-quiet truncate shrink-0 max-w-[40%]"
        title={`"${quote}"`}
      >
        &ldquo;{quote}&rdquo;
      </span>
    </li>
  );
}

function GapRow({ topic, question, why }: { topic: string; question: string; why: string }) {
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-ink text-sm">{topic}</span>
        <span className="text-xs text-very-quiet">— {why}</span>
      </div>
      <span className="text-sm text-ink-2 italic">&ldquo;{question}&rdquo;</span>
    </li>
  );
}
