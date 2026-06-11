"use client";

/**
 * FolderView — the client-folder workspace. Three tabs:
 *   Search   — compose → extracted criteria → ranked listings → packet
 *   Outreach — artifacts the folder generated + open tracking
 *   Profile  — what RelAI has learned, with provenance
 *
 * Ported from the design bundle's folder.jsx. All interactions are
 * local-state prototypes against the design dataset; server actions
 * swap in per Phase 1 plan §7 (search pipeline) and §9 (packets).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  ActiveChip,
  Ambiguity,
  Artifact,
  ChipCategory,
  ChipLibraryItem,
  ExtractedCriteria,
  LedgerEntry,
  ProfileEvent,
  RelaiFolder,
  RelaiListing,
} from "@/lib/relai-data";
import { type FolderTab, FolderTabs, OutreachTab, ProfileTab } from "./FolderTabs";
import { SmartControlPanel } from "./SmartControl";
import { I } from "./icons";

export interface FolderViewData {
  listings: RelaiListing[];
  ambiguity: Ambiguity;
  extractedCriteria: ExtractedCriteria;
  preferenceLedger: LedgerEntry[];
  chipLibrary: ChipLibraryItem[];
  activeChips: ActiveChip[];
  chipCategories: ChipCategory[];
  artifacts: Artifact[];
  profileEvents: ProfileEvent[];
}

export function FolderView({ folder, data }: { folder: RelaiFolder; data: FolderViewData }) {
  const router = useRouter();
  const firstName = folder.clientName.split(" ")[0];
  const [rawInput, setRawInput] = useState(
    "3-bed house in Fitler Square or Rittenhouse, under $900k, needs a garage and outdoor space. They love old homes with character.",
  );
  const [searched, setSearched] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set(["L01", "L03"]));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["L01"]));
  const [saves, setSaves] = useState<Set<string>>(new Set(["L01", "L02"]));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [ambiguity, setAmbiguity] = useState(data.ambiguity);
  const [showPacket, setShowPacket] = useState(false);
  const [criteria] = useState(data.extractedCriteria);

  const [tab, setTab] = useState<FolderTab>("search");
  const [smartOpen, setSmartOpen] = useState(false);
  const [chips, setChips] = useState<ActiveChip[]>(data.activeChips);

  function runSearch() {
    setThinking(true);
    setSearched(false);
    setTimeout(() => {
      setThinking(false);
      setSearched(true);
    }, 900);
  }

  function toggleIn(set: Set<string>, id: string): Set<string> {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  }

  function hideListing(id: string) {
    setHidden((prev) => new Set(prev).add(id));
    setHidingId(null);
  }

  const visible = data.listings.filter((l) => !hidden.has(l.id));

  return (
    <div className="content">
      <div className="page-head v2">
        <div className="page-head-l">
          <button
            type="button"
            className="crumb"
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Pulse · All folders
          </button>
          <h1>{folder.clientName}</h1>
          <p>{folder.notes}</p>
        </div>
        <FolderTabs active={tab} onChange={setTab} counts={{ outreach: data.artifacts.length }} />
      </div>

      {tab === "outreach" && (
        <OutreachTab folder={folder} artifacts={data.artifacts} listings={data.listings} />
      )}
      {tab === "profile" && (
        <ProfileTab
          folder={folder}
          profileEvents={data.profileEvents}
          ledger={data.preferenceLedger}
        />
      )}

      {tab === "search" && (
        <div className="folder-page">
          <div className="folder-main">
            <div className="compose">
              <div className="lbl">What is {firstName} looking for?</div>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Describe in plain English…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runSearch();
                }}
              />
              <div className="row">
                <span className="hint mono">⌘ + ENTER to search</span>
                <div className="spacer" />
                <button
                  type="button"
                  className="run"
                  onClick={runSearch}
                  disabled={!rawInput.trim() || thinking}
                >
                  <I.Search />
                  {thinking ? "Thinking…" : "Search"}
                  {!thinking && <span className="kbd">⏎</span>}
                </button>
              </div>
            </div>

            {searched && (
              <ExtractedBlock
                criteria={criteria}
                ambiguity={ambiguity}
                onResolveAmbig={(id) => {
                  setAmbiguity({
                    ...ambiguity,
                    options: ambiguity.options.map((o) => ({ ...o, picked: o.id === id })),
                  });
                }}
              />
            )}

            {thinking && (
              <div className="thinking">
                Reading {firstName}&apos;s brief
                <span className="dots" />
                <br />
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}
                >
                  PARSING · MATCHING · RERANKING WITH FOLDER TASTE
                </span>
              </div>
            )}

            {searched && !thinking && (
              <>
                <div className="results-hdr">
                  <div className="count serif">
                    Found <b>{visible.length} properties</b> for {firstName}.
                  </div>
                  <div className="spacer" />
                  <div className="view-toggle">
                    <button
                      type="button"
                      className={view === "list" ? "on" : ""}
                      onClick={() => setView("list")}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className={view === "map" ? "on" : ""}
                      onClick={() => setView("map")}
                    >
                      Map
                    </button>
                  </div>
                </div>

                {view === "list" ? (
                  <div>
                    {visible.map((l, i) => (
                      <ListingRow
                        key={l.id}
                        listing={l}
                        rank={i + 1}
                        selected={selected.has(l.id)}
                        favorite={favorites.has(l.id)}
                        saved={saves.has(l.id)}
                        expanded={expandedId === l.id}
                        hidingOpen={hidingId === l.id}
                        onToggleSel={() => setSelected((s) => toggleIn(s, l.id))}
                        onToggleFav={() => setFavorites((s) => toggleIn(s, l.id))}
                        onToggleSave={() => setSaves((s) => toggleIn(s, l.id))}
                        onExpand={() => setExpandedId(expandedId === l.id ? null : l.id)}
                        onOpenHide={() => setHidingId(hidingId === l.id ? null : l.id)}
                        onHide={() => hideListing(l.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <MapView listings={visible} selectedId={expandedId} onSelect={setExpandedId} />
                )}

                {selected.size > 0 && (
                  <div className="selbar">
                    <span className="count">
                      <b>{selected.size}</b> listing{selected.size === 1 ? "" : "s"} selected for{" "}
                      {firstName}
                    </span>
                    <div className="spacer" />
                    <button type="button" onClick={() => setSelected(new Set())}>
                      Deselect
                    </button>
                    <button type="button" className="primary" onClick={() => setShowPacket(true)}>
                      <I.FileText /> Preview packet
                    </button>
                    <button type="button">
                      <I.Mail /> Draft email
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="rail">
            <SmartControlSummary chips={chips} onOpen={() => setSmartOpen(true)} />
            <TasteCard folder={folder} />
            <LedgerCard ledger={data.preferenceLedger} />
          </aside>
        </div>
      )}

      <SmartControlPanel
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        folder={folder}
        chips={chips}
        setChips={setChips}
        chipLibrary={data.chipLibrary}
        chipCategories={data.chipCategories}
      />

      {showPacket && (
        <PacketModal
          folder={folder}
          listings={data.listings.filter((l) => selected.has(l.id))}
          onClose={() => setShowPacket(false)}
        />
      )}
    </div>
  );
}

/* ─── Extracted criteria ──────────────────────────────────────────── */

function ExtractedBlock({
  criteria,
  ambiguity,
  onResolveAmbig,
}: {
  criteria: ExtractedCriteria;
  ambiguity: Ambiguity | null;
  onResolveAmbig: (id: string) => void;
}) {
  const conf = Math.round(criteria.confidence * 100);
  return (
    <div className="extracted">
      <div className="hdr">
        <span className="title">Extracted criteria</span>
        <span className="badge conf mono">{conf}% CONFIDENCE</span>
        {criteria.ambiguities.length > 0 && (
          <span className="badge amb mono">{criteria.ambiguities.length} UNCLEAR</span>
        )}
        <span className="spacer" />
        <span className="toggle">what the AI heard</span>
      </div>
      <div className="chips">
        {criteria.hard.locations.map((l) => (
          <span key={l} className="chip-criteria extr">
            {l} <span className="x">×</span>
          </span>
        ))}
        <span className="chip-criteria extr">
          ≤ ${(criteria.hard.priceMax / 1000).toFixed(0)}k <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          {criteria.hard.bedsMin}+ bd <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          {criteria.hard.bathsMin}+ ba <span className="x">×</span>
        </span>
        <span className="chip-criteria extr">
          Garage <span className="x">×</span>
        </span>
        <span className="chip-criteria ambig">outdoor — yard, balcony, or roof deck?</span>
        <span className="chip-criteria soft">&quot;pre-war character&quot;</span>
        <span className="chip-criteria soft">&quot;outdoor space&quot;</span>
        <span className="chip-criteria add">+ add criterion</span>
      </div>
      {ambiguity && (
        <div className="ambig-resolver">
          <div className="q">{ambiguity.question}</div>
          <div className="opts">
            {ambiguity.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`opt ${o.picked ? "pick" : ""}`}
                onClick={() => onResolveAmbig(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="meta mono">RESOLVING WILL RE-RANK · SAVES TO FOLDER SOFT-PREFS</div>
        </div>
      )}
    </div>
  );
}

/* ─── Listing row ─────────────────────────────────────────────────── */

const HIDE_REASONS = [
  "Wrong block / neighborhood",
  "Too small",
  "Bad light / photos",
  "Tenant-occupied",
  "Already seen it",
  "Wrong property type",
  "Other…",
];

function ListingRow({
  listing: l,
  rank,
  selected,
  favorite,
  saved,
  expanded,
  hidingOpen,
  onToggleSel,
  onToggleFav,
  onToggleSave,
  onExpand,
  onOpenHide,
  onHide,
}: {
  listing: RelaiListing;
  rank: number;
  selected: boolean;
  favorite: boolean;
  saved: boolean;
  expanded: boolean;
  hidingOpen: boolean;
  onToggleSel: () => void;
  onToggleFav: () => void;
  onToggleSave: () => void;
  onExpand: () => void;
  onOpenHide: () => void;
  onHide: (reason: string) => void;
}) {
  const priceFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(l.price);
  const cls = l.match >= 85 ? "hi" : l.match >= 75 ? "mid" : "lo";

  // "Why": highlight the matched phrases inside the remarks text
  const whySpans: React.ReactNode[] = [];
  let txt = l.remarks;
  for (const [phrase] of l.whyHighlights ?? []) {
    const idx = txt.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      whySpans.push(<span key={`${phrase}-pre`}>{txt.slice(0, idx)}</span>);
      whySpans.push(
        <span key={phrase} className="hl">
          {txt.slice(idx, idx + phrase.length)}
        </span>,
      );
      txt = txt.slice(idx + phrase.length);
    }
  }
  whySpans.push(<span key="rest">{txt}</span>);

  const photoUrl = l.photoUrls[0];

  return (
    <div className={`listing ${selected ? "sel" : ""}`}>
      <div className="top">
        <div className="rank serif">{String(rank).padStart(2, "0")}</div>
        <div
          className={`photo ${l.photos[0] || ""}`}
          onClick={onToggleSel}
          onKeyDown={(e) => {
            if (e.key === "Enter") onToggleSel();
          }}
          // biome-ignore lint/a11y/useSemanticElements: design CSS targets .listing .photo as a sized div; native button UA styles would break the swatch layout
          role="button"
          tabIndex={0}
          style={
            photoUrl
              ? {
                  backgroundImage: `url('${photoUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!photoUrl && <span className="note">PHOTO · MLS FEED</span>}
          {l.photoUrls.length > 1 && (
            <span className="photo-count mono">+{l.photoUrls.length - 1}</span>
          )}
        </div>
        <div
          className="body"
          onClick={onToggleSel}
          onKeyDown={(e) => {
            if (e.key === "Enter") onToggleSel();
          }}
          // biome-ignore lint/a11y/useSemanticElements: rich multi-line card body; design CSS expects a block div, not a native button
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
        >
          <div className="priceline">
            <span className="price">{priceFmt}</span>
            {favorite && <span style={{ color: "var(--rose)", fontSize: 11 }}>♥ Favorite</span>}
            {saved && !favorite && (
              <span style={{ color: "var(--accent)", fontSize: 11 }}>● Saved</span>
            )}
          </div>
          <div className="addr">
            {l.address} · {l.neighborhood} · {l.zip}
          </div>
          <div className="stats mono">
            <b>{l.beds}</b> BD · <b>{l.baths}</b> BA · <b>{l.sqft.toLocaleString()}</b> SF · BUILT{" "}
            <b>{l.yearBuilt}</b> · {l.dom}d ON MARKET
          </div>
          <div className="why">{whySpans}</div>
          {l.stretch && <div className="stretch">⚠ {l.stretch}</div>}
          {l.negotiable && (
            <div
              className="stretch"
              style={{ background: "var(--moss-soft)", color: "var(--moss)" }}
            >
              ↓ {l.negotiable}
            </div>
          )}
        </div>
        <div className="right">
          <button type="button" className="match" onClick={onExpand} title="Click to explain">
            <div className={`num ${cls}`}>{l.match}</div>
            <div className="lbl">
              MATCH <span className="info">ⓘ</span>
            </div>
          </button>
          <div className="actions">
            <button
              type="button"
              className={`fav ${favorite ? "on" : ""}`}
              onClick={onToggleFav}
              title="Favorite"
            >
              <I.Heart filled={favorite} />
            </button>
            <button
              type="button"
              className={`save ${saved ? "on" : ""}`}
              onClick={onToggleSave}
              title="Save"
            >
              <I.Bookmark filled={saved} />
            </button>
            <button type="button" onClick={onOpenHide} title="Hide">
              <I.EyeOff />
            </button>
          </div>
        </div>
      </div>
      {expanded && <ScoreExplain listing={l} />}
      {hidingOpen && (
        <div className="hide-reasons">
          <div className="q">Why hide {l.address.split(",")[0]}?</div>
          <div className="opts">
            {HIDE_REASONS.map((r) => (
              <button key={r} type="button" className="opt" onClick={() => onHide(r)}>
                {r}
              </button>
            ))}
          </div>
          <div className="meta">FEEDS FOLDER EMBEDDING · SOURCE = AGENT-TAG (PROVENANCE 2/4)</div>
        </div>
      )}
    </div>
  );
}

/* ─── Score explain (the "show our work" panel) ───────────────────── */

function ScoreExplain({ listing: l }: { listing: RelaiListing }) {
  const rows = [
    { k: "Price", v: l.priceScore, c: "" },
    { k: "Location", v: l.locationScore, c: "" },
    { k: "Beds", v: l.bedsScore, c: "" },
    { k: "Baths", v: l.bathsScore, c: "" },
    { k: "Features", v: l.featureScore, c: "" },
    { k: "Semantic", v: l.semantic, c: "orange" },
  ];
  const prefSign = l.preferenceBoost >= 0 ? "+" : "−";
  return (
    <div className="explain">
      <div className="hdr">
        <span>
          HEURISTIC <b>{l.heuristic.toFixed(2)}</b>
        </span>
        <span>·</span>
        <span>
          SEMANTIC <b>{l.semantic.toFixed(2)}</b>
        </span>
        <span>·</span>
        <span>
          BLEND <b>w = 0.20</b>
        </span>
      </div>
      <div className="rows">
        {rows.map((r) => (
          <div key={r.k} className="explain-row">
            <span className="lbl">{r.k}</span>
            <div className="track">
              <div className={`fill ${r.c}`} style={{ width: `${r.v * 100}%` }} />
            </div>
            <span className="val">{r.v.toFixed(2)}</span>
          </div>
        ))}
        <div className="explain-row">
          <span className="lbl">Pref boost</span>
          <div className="track">
            <div
              className={`fill ${l.preferenceBoost >= 0 ? "moss" : "rose"}`}
              style={{ width: `${Math.abs(l.preferenceBoost) * 500}%` }}
            />
          </div>
          <span className={`val ${l.preferenceBoost >= 0 ? "up" : "dn"}`}>
            {prefSign}
            {Math.abs(l.preferenceBoost).toFixed(2)}
          </span>
        </div>
        <div className="explain-row sum">
          <span className="lbl">Final match</span>
          <div className="track">
            <div className="fill" style={{ width: `${l.match}%` }} />
          </div>
          <span className="val">{l.match}</span>
        </div>
      </div>
      <div className="explain-foot">
        SEMANTIC STATE:{" "}
        <span className={`tag ${l.semanticState}`}>{l.semanticState.toUpperCase()}</span>·
        &quot;applied&quot; means the model compared this listing&apos;s text to the folder&apos;s
        taste vector and returned a similarity score.
      </div>
    </div>
  );
}

/* ─── Right rail cards ────────────────────────────────────────────── */

function SmartControlSummary({ chips, onOpen }: { chips: ActiveChip[]; onOpen: () => void }) {
  const positives = chips.filter((c) => c.polarity === "positive");
  const avoidances = chips.filter((c) => c.polarity === "avoidance");
  const topPos = positives.slice(0, 4);
  const topAvo = avoidances.slice(0, 3);
  return (
    <div className="card sc-summary">
      <div className="sc-summary-hdr">
        <h6 style={{ margin: 0, flex: 1 }}>Smart Control</h6>
        <button
          type="button"
          className="sc-summary-edit"
          onClick={onOpen}
          style={{ backgroundColor: "rgb(55, 107, 182)", color: "rgb(250, 250, 250)" }}
        >
          Edit →
        </button>
      </div>
      <div className="sc-summary-row">
        <div className="sc-summary-col">
          <div className="sc-summary-eyebrow up mono">↑ POSITIVES · {positives.length}</div>
          <div className="sc-summary-chips">
            {topPos.map((c) => (
              <span key={c.id} className="sc-chip mini positive">
                {c.label}
              </span>
            ))}
            {positives.length > topPos.length && (
              <span className="sc-chip mini more">+{positives.length - topPos.length}</span>
            )}
          </div>
        </div>
        <div className="sc-summary-col">
          <div className="sc-summary-eyebrow dn mono">↓ AVOIDANCES · {avoidances.length}</div>
          <div className="sc-summary-chips">
            {topAvo.length === 0 && <span className="sc-summary-empty">none yet</span>}
            {topAvo.map((c) => (
              <span key={c.id} className="sc-chip mini avoidance">
                {c.label}
              </span>
            ))}
            {avoidances.length > topAvo.length && (
              <span className="sc-chip mini more">+{avoidances.length - topAvo.length}</span>
            )}
          </div>
        </div>
      </div>
      <div className="sc-summary-foot mono">TASTE VECTOR · LIVE · CLICK EDIT TO RE-RANK</div>
    </div>
  );
}

function TasteCard({ folder }: { folder: RelaiFolder }) {
  const bars = folder.tasteBars ?? [
    { k: "Pre-war stock", v: 0.88 },
    { k: "Private outdoor", v: 0.82 },
    { k: "Walkability", v: 0.74 },
    { k: "Quiet street", v: 0.61 },
    { k: "New construction", v: 0.18 },
  ];
  const sig = folder.signals ?? { explicit: 2, agentTag: 3, pitched: 2, softPref: 8 };
  return (
    <div className="card">
      <h6>{folder.clientName.split(" ")[0]}&apos;s taste · live</h6>
      <div className="taste-head">{folder.tasteHeadline}</div>
      <div className="taste-sub">
        Built from {folder.savedCount} saves, {folder.favoriteCount} favorites, and 3 hides across 3
        searches.
      </div>
      {bars.map((b) => (
        <div key={b.k} className="bar-row">
          <span className="lbl">{b.k}</span>
          <div className="tk">
            <span style={{ width: `${b.v * 100}%` }} />
          </div>
          <span className="val">{b.v.toFixed(2)}</span>
        </div>
      ))}
      <div className="signal-row">
        <span className="p hot">explicit · {sig.explicit}</span>
        <span className="p">agent-tag · {sig.agentTag}</span>
        <span className="p">pitched · {sig.pitched}</span>
        <span className="p">soft-pref · {sig.softPref}</span>
      </div>
    </div>
  );
}

function LedgerCard({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <div className="card">
      <h6>Preference ledger</h6>
      <div className="ledger">
        {ledger.map((r) => (
          <div key={`${r.k}:${r.src}`} className="row">
            <div className="k">
              {r.k} <em>{r.delta}</em>
            </div>
            <div className="v">
              <span className={`dir ${r.dir}`}>{r.dir === "up" ? "↑ boost" : "↓ penalty"}</span>
              <span className="src">{r.src}</span>
              <button type="button" className="undo">
                undo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Map view ────────────────────────────────────────────────────── */

function MapView({
  listings,
  selectedId,
  onSelect,
}: {
  listings: RelaiListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mapview">
      <div className="m-left">
        {listings.map((l) => (
          <div
            key={l.id}
            className={`item ${selectedId === l.id ? "active" : ""}`}
            onClick={() => onSelect(l.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(l.id);
            }}
            // biome-ignore lint/a11y/useSemanticElements: design CSS targets .m-left .item as a flex div; native button UA styles would shift the rail layout
            role="button"
            tabIndex={0}
          >
            <div className={`thumb ${l.photos[0] || ""}`} />
            <div>
              <div className="px">
                ${(l.price / 1000).toFixed(0)}k <span className="match">MATCH {l.match}</span>
              </div>
              <div className="addr">
                {l.address.split(",")[0]} · {l.neighborhood}
              </div>
              <div className="stats">
                {l.beds} BD · {l.baths} BA · {l.sqft.toLocaleString()} SF · {l.dom}d
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="m-canvas">
        <div className="grid" />
        <div className="river" />
        <div className="road" style={{ left: 0, right: 0, top: "32%", height: "3px" }} />
        <div className="road" style={{ left: 0, right: 0, top: "68%", height: "3px" }} />
        <div className="road" style={{ top: 0, bottom: 0, left: "36%", width: "3px" }} />
        <div className="road" style={{ top: 0, bottom: 0, left: "68%", width: "3px" }} />
        <div className="label" style={{ top: "22%", left: "8%" }}>
          Schuylkill R.
        </div>
        <div className="label" style={{ top: "12%", left: "44%" }}>
          Rittenhouse Sq
        </div>
        <div className="label" style={{ top: "56%", left: "14%" }}>
          Fitler Square
        </div>
        <div className="label" style={{ top: "76%", left: "50%" }}>
          Graduate Hosp.
        </div>
        {listings.map((l, i) => (
          <button
            key={l.id}
            type="button"
            className={`pin ${i === 0 ? "hot " : ""}${selectedId === l.id ? "active" : ""}`}
            style={{ left: `${l.lng * 100}%`, top: `${l.lat * 100}%` }}
            onClick={() => onSelect(l.id)}
          >
            {i + 1} · {l.match}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Packet modal ────────────────────────────────────────────────── */

function PacketModal({
  folder,
  listings,
  onClose,
}: {
  folder: RelaiFolder;
  listings: RelaiListing[];
  onClose: () => void;
}) {
  const [opts, setOpts] = useState({
    cover: true,
    photos: true,
    remarks: true,
    walkscore: false,
    compare: true,
  });
  const toggle = (k: keyof typeof opts) => setOpts({ ...opts, [k]: !opts[k] });
  const pageCount = (opts.cover ? 1 : 0) + listings.length + (opts.compare ? 1 : 0);
  const firstName = folder.clientName.split(" ")[0];

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const sections: Array<{ key: keyof typeof opts; label: string }> = [
    { key: "cover", label: "Personalized cover letter" },
    { key: "photos", label: "Include MLS photos" },
    { key: "remarks", label: "Public remarks (PII-redacted)" },
    { key: "walkscore", label: "Walk score + commute times" },
    { key: "compare", label: "Side-by-side comparison" },
  ];

  return (
    <div
      className="scrim"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        // biome-ignore lint/a11y/useSemanticElements: design CSS styles .modal as a div; the native dialog element brings its own backdrop + open semantics that conflict with the scrim
        role="dialog"
        aria-modal="true"
      >
        <div className="m-hdr">
          <div className="t">Packet for {firstName}.</div>
          <div className="sub mono">
            {pageCount} PAGES · {listings.length} LISTINGS
          </div>
          <button type="button" className="close" onClick={onClose}>
            <I.X />
          </button>
        </div>
        <div className="m-body">
          <div className="preview-area">
            <div className="pages">
              {opts.cover && (
                <div className="preview-page cover">
                  <div className="eyebrow">{today} · Curated for</div>
                  <div className="hdr-serif" style={{ marginTop: 4 }}>
                    {folder.clientName}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="lines">
                      <span className="l" />
                      <span className="m" />
                      <span className="l" />
                      <span className="s" />
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 6.5,
                      fontStyle: "italic",
                      color: "var(--ink-3)",
                    }}
                  >
                    &quot;Three Fitler Square rowhomes I think you&apos;ll love, plus two
                    Rittenhouse trinities worth a second look.&quot;
                  </div>
                  <div className="foot">
                    <span>RELAI</span>
                    <span>COVER</span>
                  </div>
                </div>
              )}
              {listings.map((l, i) => (
                <div key={l.id} className="preview-page">
                  <div className="eyebrow">
                    No. {String(i + 1).padStart(2, "0")} · match {l.match}
                  </div>
                  <div
                    className={`img ${l.photos[0] || ""}`}
                    style={
                      l.photoUrls[0]
                        ? {
                            backgroundImage: `url('${l.photoUrls[0]}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />
                  <div className="big">{l.address.split(",")[0]}</div>
                  <div className="med">
                    ${(l.price / 1000).toFixed(0)}k · {l.beds}bd · {l.baths}ba ·{" "}
                    {l.sqft.toLocaleString()} SF
                  </div>
                  {opts.remarks && (
                    <div className="lines" style={{ marginTop: 5 }}>
                      <span className="l" />
                      <span className="m" />
                      <span className="s" />
                    </div>
                  )}
                  <div className="foot">
                    <span>{l.neighborhood}</span>
                    <span>P. {i + (opts.cover ? 2 : 1)}</span>
                  </div>
                </div>
              ))}
              {opts.compare && (
                <div className="preview-page">
                  <div className="eyebrow">Side-by-side</div>
                  <div className="hdr-serif" style={{ fontSize: 9, marginTop: 3 }}>
                    Comparison
                  </div>
                  <div className="lines" style={{ marginTop: 6 }}>
                    <span className="l" />
                    <span className="l" />
                    <span className="l" />
                    <span className="m" />
                    <span className="m" />
                    <span className="m" />
                    <span className="s" />
                  </div>
                  <div className="foot">
                    <span>COMPARE</span>
                    <span>P. {pageCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="controls">
            <h5>Sections</h5>
            {sections.map((s) => (
              <div
                key={s.key}
                className={`opt ${opts[s.key] ? "on" : ""}`}
                onClick={() => toggle(s.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") toggle(s.key);
                }}
                // biome-ignore lint/a11y/useSemanticElements: design CSS draws the custom .ck checkbox; a native input would double-render the control
                role="checkbox"
                aria-checked={opts[s.key]}
                tabIndex={0}
              >
                <div className="ck">{opts[s.key] && <I.Check />}</div>
                {s.label}
              </div>
            ))}
            <div className="meta mono">
              ~1.8 MB · READY IN 2–4s
              <br />
              <br />
              RelAI will write the cover letter by summarizing why these {listings.length} listings
              suit {firstName}&apos;s taste profile.
            </div>
          </div>
        </div>
        <div className="m-foot">
          <span className="status mono">● ready to generate</span>
          <button type="button" className="cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="generate">
            Generate packet →
          </button>
        </div>
      </div>
    </div>
  );
}
