"use client";

/**
 * Smart Control — the right-side panel that shows the *real, editable*
 * taste of a folder. Two clusters of chips: positives (ranks ↑) and
 * avoidances (ranks ↓). Drag a chip across to flip its polarity, or drag
 * it to the trash to delete. A categorized library adds chips; a
 * dictation slot parses plain English into chips for review-then-commit.
 *
 * This panel embodies the thesis: an agent's understanding of a client
 * should be a thing you can hold in your hand, not a black box.
 *
 * Ported from the design bundle's smart-control.jsx. The dictation parse
 * is a local mock until the LLM intent endpoint lands (Week 6) — the
 * review-before-commit contract is identical.
 */

import { useState } from "react";

import type { ActiveChip, ChipCategory, ChipLibraryItem, RelaiFolder } from "@/lib/relai-data";

const SOURCE_LABELS: Record<string, string> = {
  explicit: "you said",
  "agent-tag": "agent tag",
  "search-parse": "from search",
  "soft-pref": "soft pref",
  hide: "from hide",
  dictate: "dictated",
  library: "library",
};

type DropTarget = "positive" | "avoidance" | "trash" | null;

function Chip({
  chip,
  dragging,
  hovered,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
}: {
  chip: ActiveChip;
  dragging: boolean;
  hovered: boolean;
  onDragStart: (e: React.DragEvent, chip: ActiveChip) => void;
  onDragEnd: () => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className={`sc-chip ${chip.polarity}${dragging ? " dragging" : ""}${hovered ? " hovered" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, chip)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onMouseEnter(chip.id)}
      onMouseLeave={onMouseLeave}
    >
      <span className="sc-grip">⋮⋮</span>
      <span className="sc-chip-label">{chip.label}</span>
      <span className="sc-chip-src">{SOURCE_LABELS[chip.source] || chip.source}</span>
    </div>
  );
}

function Cluster({
  polarity,
  title,
  hint,
  chips,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onChipDragStart,
  onChipDragEnd,
  draggingId,
  hoveredId,
  setHoveredId,
}: {
  polarity: "positive" | "avoidance";
  title: string;
  hint: string;
  chips: ActiveChip[];
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onChipDragStart: (e: React.DragEvent, chip: ActiveChip) => void;
  onChipDragEnd: () => void;
  draggingId: string | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}) {
  return (
    <div
      className={`sc-cluster ${polarity}${dragOver ? " drop-target" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="sc-cluster-hdr">
        <span className="sc-cluster-dot" />
        <span className="sc-cluster-title">{title}</span>
        <span className="sc-cluster-count mono">{chips.length}</span>
      </div>
      <div className="sc-cluster-hint">{hint}</div>
      <div className="sc-cluster-body">
        {chips.length === 0 && (
          <div className="sc-cluster-empty">Drag chips here, or add from library below.</div>
        )}
        {chips.map((c) => (
          <Chip
            key={c.id}
            chip={c}
            dragging={draggingId === c.id}
            hovered={hoveredId === c.id}
            onDragStart={onChipDragStart}
            onDragEnd={onChipDragEnd}
            onMouseEnter={setHoveredId}
            onMouseLeave={() => setHoveredId(null)}
          />
        ))}
      </div>
    </div>
  );
}

function Library({
  chipLibrary,
  chipCategories,
  activeKeys,
  onAdd,
}: {
  chipLibrary: ChipLibraryItem[];
  chipCategories: ChipCategory[];
  activeKeys: Record<string, "positive" | "avoidance">;
  onAdd: (
    item: { key: string; label: string },
    polarity: "positive" | "avoidance",
    source?: string,
  ) => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>("home_feel_character");
  const [filter, setFilter] = useState("");
  const filt = filter.trim().toLowerCase();

  return (
    <div className="sc-library">
      <div className="sc-library-hdr">
        <span className="sc-library-title">Library</span>
        <input
          className="sc-library-search"
          placeholder="Filter chips…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {chipCategories.map((cat) => {
        const items = chipLibrary
          .filter((c) => c.category === cat.key)
          .filter((c) => !filt || c.label.toLowerCase().includes(filt));
        if (filt && items.length === 0) return null;
        const open = filt ? true : openCat === cat.key;
        return (
          <div key={cat.key} className={`sc-cat ${open ? "open" : ""}`}>
            <button
              type="button"
              className="sc-cat-hdr"
              onClick={() => setOpenCat(open ? null : cat.key)}
            >
              <span className="sc-cat-caret">{open ? "▾" : "▸"}</span>
              <span className="sc-cat-label">{cat.label}</span>
              <span className="sc-cat-count mono">{items.length}</span>
            </button>
            {open && (
              <div className="sc-cat-body">
                {items.map((item) => {
                  const inUse = activeKeys[item.key];
                  return (
                    <div key={item.id} className={`sc-lib-row ${inUse ? `in-use ${inUse}` : ""}`}>
                      <span className="sc-lib-label">{item.label}</span>
                      {inUse ? (
                        <span className="sc-lib-status mono">
                          {inUse === "positive" ? "↑ in positives" : "↓ in avoid"}
                        </span>
                      ) : (
                        <span className="sc-lib-actions">
                          <button
                            type="button"
                            className="sc-lib-add pos"
                            onClick={() => onAdd(item, "positive")}
                            title="Add as positive"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="sc-lib-add avoid"
                            onClick={() => onAdd(item, "avoidance")}
                            title="Add as avoidance"
                          >
                            ↓
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ParsedGuess {
  key: string;
  label: string;
  polarity: "positive" | "avoidance";
}

function Dictate({
  onAdd,
}: {
  onAdd: (
    item: { key: string; label: string },
    polarity: "positive" | "avoidance",
    source?: string,
  ) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedGuess[] | null>(null);

  function run() {
    if (!text.trim()) return;
    setBusy(true);
    setParsed(null);
    // Mock parse until the LLM intent endpoint lands; same review contract.
    setTimeout(() => {
      const lower = text.toLowerCase();
      const guesses: ParsedGuess[] = [];
      if (/(quiet|main road|busy)/i.test(lower))
        guesses.push({ key: "on_main_road", label: "On a main road", polarity: "avoidance" });
      if (/(brick|prewar|old|character|historic|charm)/i.test(lower))
        guesses.push({ key: "prewar_character", label: "Pre-war character", polarity: "positive" });
      if (/(yard|garden|patio|outdoor)/i.test(lower))
        guesses.push({ key: "private_yard", label: "Private outdoor", polarity: "positive" });
      if (/(school|kids|family)/i.test(lower))
        guesses.push({
          key: "top_rated_schools",
          label: "Top-rated schools",
          polarity: "positive",
        });
      if (/(walk|stroll|near)/i.test(lower))
        guesses.push({ key: "walkable", label: "Walkable", polarity: "positive" });
      if (guesses.length === 0) {
        guesses.push({
          key: `custom_${Date.now()}`,
          label: text.slice(0, 40),
          polarity: "positive",
        });
      }
      setParsed(guesses);
      setBusy(false);
    }, 700);
  }

  function commit() {
    if (!parsed) return;
    for (const g of parsed) {
      onAdd({ key: g.key, label: g.label }, g.polarity, "dictate");
    }
    setParsed(null);
    setText("");
  }

  return (
    <div className="sc-dictate">
      <div className="sc-dictate-row">
        <textarea
          className="sc-dictate-input"
          placeholder='Tell RelAI about this client — "they hate busy streets, love brick row-homes…"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <button
          type="button"
          className="sc-dictate-run"
          onClick={run}
          disabled={busy || !text.trim()}
        >
          {busy ? "Parsing…" : "Parse →"}
        </button>
      </div>
      {parsed && (
        <div className="sc-dictate-parsed">
          <div className="sc-dictate-parsed-hdr mono">
            FOUND {parsed.length} CHIP{parsed.length === 1 ? "" : "S"} — REVIEW BEFORE ADDING
          </div>
          <div className="sc-dictate-parsed-list">
            {parsed.map((g) => (
              <span key={g.key} className={`sc-chip mini ${g.polarity}`}>
                {g.polarity === "positive" ? "↑ " : "↓ "}
                {g.label}
              </span>
            ))}
          </div>
          <div className="sc-dictate-actions">
            <button type="button" className="sc-dictate-cancel" onClick={() => setParsed(null)}>
              Discard
            </button>
            <button type="button" className="sc-dictate-commit" onClick={commit}>
              Add all to board →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SmartControlPanel({
  open,
  onClose,
  folder,
  chips,
  setChips,
  chipLibrary,
  chipCategories,
}: {
  open: boolean;
  onClose: () => void;
  folder: RelaiFolder;
  chips: ActiveChip[];
  setChips: React.Dispatch<React.SetStateAction<ActiveChip[]>>;
  chipLibrary: ChipLibraryItem[];
  chipCategories: ChipCategory[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const positives = chips.filter((c) => c.polarity === "positive");
  const avoidances = chips.filter((c) => c.polarity === "avoidance");
  const firstName = folder.clientName.split(" ")[0];

  const activeKeys: Record<string, "positive" | "avoidance"> = {};
  for (const c of chips) activeKeys[c.key] = c.polarity;

  function onChipDragStart(e: React.DragEvent, chip: ActiveChip) {
    setDraggingId(chip.id);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", chip.id);
    } catch {
      // some webviews throw on setData; the id in state is enough
    }
  }
  function onChipDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function dropOnCluster(targetPolarity: "positive" | "avoidance") {
    if (!draggingId) return;
    setChips((prev) =>
      prev.map((c) => (c.id === draggingId ? { ...c, polarity: targetPolarity } : c)),
    );
    setDraggingId(null);
    setDropTarget(null);
  }
  function dropOnTrash() {
    if (!draggingId) return;
    setChips((prev) => prev.filter((c) => c.id !== draggingId));
    setDraggingId(null);
    setDropTarget(null);
  }

  function addFromLibrary(
    item: { key: string; label: string },
    polarity: "positive" | "avoidance",
    source?: string,
  ) {
    setChips((prev) => {
      const existing = prev.find((c) => c.key === item.key);
      if (existing) {
        if (existing.polarity !== polarity) {
          return prev.map((c) => (c.id === existing.id ? { ...c, polarity } : c));
        }
        return prev;
      }
      return [
        ...prev,
        {
          id: `ch_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          key: item.key,
          label: item.label,
          polarity,
          source: source || "library",
          weight: 0.5,
        },
      ];
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        className="sc-scrim"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="presentation"
      />
      <aside className="sc-panel">
        <header className="sc-hdr">
          <div className="sc-hdr-l">
            <div className="sc-eyebrow mono">SMART CONTROL · {firstName}</div>
            <div className="sc-title serif">
              What RelAI thinks {firstName} {folder.clientName.includes("&") ? "want" : "wants"}.
            </div>
            <div className="sc-sub">
              Drag chips between clusters to flip polarity. Drag to the trash to remove. Add new
              from the library, or describe in plain words.
            </div>
          </div>
          <button type="button" className="sc-close" onClick={onClose} title="Close">
            ×
          </button>
        </header>

        <Dictate onAdd={addFromLibrary} />

        <div className="sc-board">
          <Cluster
            polarity="positive"
            title="Positives — rank these ↑"
            hint="Things to amplify when ranking listings."
            chips={positives}
            dragOver={dropTarget === "positive"}
            onDragOver={() => setDropTarget("positive")}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => dropOnCluster("positive")}
            onChipDragStart={onChipDragStart}
            onChipDragEnd={onChipDragEnd}
            draggingId={draggingId}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
          />
          <Cluster
            polarity="avoidance"
            title="Avoidances — rank these ↓"
            hint="Things to penalize. Strong signal — these win ties."
            chips={avoidances}
            dragOver={dropTarget === "avoidance"}
            onDragOver={() => setDropTarget("avoidance")}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => dropOnCluster("avoidance")}
            onChipDragStart={onChipDragStart}
            onChipDragEnd={onChipDragEnd}
            draggingId={draggingId}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
          />
        </div>

        <div
          className={`sc-trash${draggingId ? " armed" : ""}${dropTarget === "trash" ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget("trash");
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => {
            e.preventDefault();
            dropOnTrash();
          }}
        >
          <span className="sc-trash-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Trash</title>
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </span>
          <span className="sc-trash-label">
            {draggingId ? "Drop here to remove" : "Drag a chip here to remove it"}
          </span>
        </div>

        <Library
          chipLibrary={chipLibrary}
          chipCategories={chipCategories}
          activeKeys={activeKeys}
          onAdd={addFromLibrary}
        />

        <footer className="sc-foot">
          <div className="sc-foot-stats mono">
            {positives.length} POSITIVE · {avoidances.length} AVOIDANCE · LAST EDIT JUST NOW
          </div>
          <div className="sc-foot-actions">
            <button type="button" className="sc-foot-revert">
              Revert session
            </button>
            <button type="button" className="sc-foot-save" onClick={onClose}>
              Apply &amp; re-rank →
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
