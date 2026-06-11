"use client";

/**
 * HomeView — the search-first landing. Faithful port of the design
 * bundle's HomePage (sidebar.jsx):
 *
 *   - 3D water orb floating in the pool, bobbing on the shared clock
 *   - Waterline ripples emanating from the sphere
 *   - Push-to-talk: hold SHIFT anywhere (or hold the orb / mic button)
 *   - Crystallization seeds bloom from the orb after dictation
 *   - Search-as-drop: the orb plunges + screen ripple on submit
 *   - Attachments strip (audio / docs / images)
 *   - "Add to folder…" picker — search files into a client folder
 *   - Pulse feed: what moved overnight
 *
 * Dictation streams a simulated transcript until the real /transcribe
 * pipeline lands (Week 7); the interaction contract is identical.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { PulseItem, RelaiFolder } from "@/lib/relai-data";
import { Pool } from "./Pool";
import { WaterOrb } from "./WaterOrb";
import { WaterlineRipples, useOrbBob } from "./WaterlineRipples";
import { I } from "./icons";
import { rippleClock } from "./ripple-clock";

interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: "audio" | "doc" | "image";
}

const DICTATION =
  "Couple with two kids relocating from Brooklyn, budget around one point one million, want a real yard, not a tiny patio, needs three bedrooms, loves pre-war, Fitler or Rittenhouse, no new construction please.";

const SEEDS = [
  "3 BD",
  "Fitler Square",
  "Rittenhouse",
  "≤ $1.1M",
  "real yard",
  "pre-war",
  "no new construction",
];

function eyebrowDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${day} · ${mm} · ${dd}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({
  folders,
  pulse,
  agentFirstName,
}: {
  folders: RelaiFolder[];
  pulse: PulseItem[];
  agentFirstName: string;
}) {
  const router = useRouter();
  const folderMap = Object.fromEntries(folders.map((f) => [f.id, f]));
  const [query, setQuery] = useState("");
  const [targetFolder, setTargetFolder] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listening, setListening] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [crystallizing, setCrystallizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const orbBobRef = useOrbBob(listening);
  const listeningRef = useRef(false);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dictationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: `${f.name}:${f.size}:${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        kind: f.type.startsWith("audio/")
          ? ("audio" as const)
          : f.type.startsWith("image/")
            ? ("image" as const)
            : ("doc" as const),
      })),
    ]);
    e.target.value = "";
  }

  function startListening() {
    if (listeningRef.current) return;
    listeningRef.current = true;
    setListening(true);
    startRef.current = performance.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - startRef.current);
    }, 80);
    const words = DICTATION.split(" ");
    let i = 0;
    setQuery((q) => {
      const prefix = q && !q.endsWith(" ") ? `${q} ` : q;
      dictationRef.current = setInterval(() => {
        if (!listeningRef.current || i >= words.length) {
          if (dictationRef.current) clearInterval(dictationRef.current);
          dictationRef.current = null;
          return;
        }
        setQuery(prefix + words.slice(0, i + 1).join(" "));
        i++;
      }, 140);
      return q;
    });
  }

  function stopListening() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setListening(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (dictationRef.current) {
      clearInterval(dictationRef.current);
      dictationRef.current = null;
    }
    setElapsedMs(0);
    setCrystallizing(true);
    setTimeout(() => setCrystallizing(false), 2400);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: startListening/stopListening are stable closures over refs; bind global Shift push-to-talk once
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        startListening();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") stopListening();
    }
    function onBlur() {
      stopListening();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stopListening();
    };
  }, []);

  const selected = targetFolder ? folderMap[targetFolder] : null;

  function go() {
    if (!query.trim() || submitting) return;
    if (!targetFolder) {
      setPickerOpen(true);
      return;
    }
    // Search-as-drop: the sphere plunges, the page splashes, then we navigate.
    setSubmitting(true);
    rippleClock.forceSplash(1.3);
    setTimeout(() => {
      router.push(`/folders/${targetFolder}`);
    }, 720);
  }

  const sec = Math.floor(elapsedMs / 1000);
  const tenths = Math.floor((elapsedMs % 1000) / 100);

  return (
    <div className="content">
      <div className="page-head home-head">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow-day mono" style={{ opacity: 1, fontSize: 20 }}>
              {eyebrowDate()}
            </span>
            <span className="eyebrow-rule" />
            <span className="eyebrow-greet" style={{ fontSize: 25 }}>
              {greeting()}, {agentFirstName}.
            </span>
          </div>
          <h1 className="home-h1">
            Where would you like to <em>begin?</em>
          </h1>
          <p className="home-sub">
            Speak or type a search in plain English. RelAI will re-rank results using a client
            folder&apos;s <em style={{ color: "var(--accent)" }}>Taste</em> profile.
          </p>
        </div>
        <div className="constellation">
          <div
            className="const-label mono"
            style={{ color: "rgb(0, 0, 0)", fontSize: 12, height: 60 }}
          >
            RECENT
          </div>
          <button
            type="button"
            className="const-orb"
            title="3-bed Fitler Square under $900k · Sarah & Mike"
            onClick={() => router.push("/folders/f_sarah")}
          >
            <span className="const-orb-bubble" />
            <span className="const-orb-name">Sarah</span>
            <span className="const-orb-meta mono" style={{ color: "rgb(0, 0, 0)" }}>
              3D AGO · 12
            </span>
          </button>
          <button
            type="button"
            className="const-orb"
            title="South Philly trinity, ~$550k · David"
            onClick={() => router.push("/folders/f_david")}
          >
            <span className="const-orb-bubble" />
            <span className="const-orb-name">David</span>
            <span className="const-orb-meta mono" style={{ color: "rgb(0, 0, 0)" }}>
              1W AGO · 7
            </span>
          </button>
          <button
            type="button"
            className="const-orb pulsing"
            title="Loft, Northern Liberties · Linh — 2 new"
            onClick={() => router.push("/folders/f_linh")}
          >
            <span className="const-orb-bubble" />
            <span className="const-orb-name">Linh</span>
            <span className="const-orb-meta mono">● 2 NEW</span>
          </button>
        </div>
      </div>

      <div className="orb-wrap">
        {submitting && (
          <div className="screen-ripple" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {crystallizing && (
          <div className="seeds" aria-hidden="true">
            {SEEDS.map((s, i) => (
              <span key={s} className={`seed seed-${i}`}>
                {s}
              </span>
            ))}
          </div>
        )}
        <div
          className={`orb-stage ${listening ? "orb-stage--listening " : ""}${submitting ? "orb-stage--diving" : ""}`}
        >
          <Pool listening={listening} submitting={submitting} />
          <WaterlineRipples listening={listening} submitting={submitting} />

          <div ref={orbBobRef} className="orb-bobber">
            <button
              type="button"
              className={`orb ${listening ? "orb--listening" : ""}`}
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onMouseLeave={stopListening}
              onTouchStart={(e) => {
                e.preventDefault();
                startListening();
              }}
              onTouchEnd={stopListening}
              title="Hold to dictate"
            >
              <span className="orb-glow" />
              <span className="orb-glow orb-glow-2" />
              <WaterOrb listening={listening} />
            </button>
          </div>
        </div>

        <div className="orb-caption">
          {listening ? (
            <>
              <div className="orb-t serif">I&apos;m listening…</div>
              <div className="orb-s mono">
                ● RECORDING · {sec}.{tenths}s
              </div>
            </>
          ) : (
            <div className="orb-hints">
              <div className="orb-hint">
                <span className="hint-icon hint-cursor">
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <title>Click and hold</title>
                    <path d="M4 3 L4 17 L8.2 13.5 L10.6 19 L13 18 L10.6 12.6 L16 12.3 Z" />
                  </svg>
                  <span className="click-ring" />
                  <span className="click-ring click-ring-2" />
                </span>
                <span className="hint-lbl">CLICK &amp; HOLD</span>
              </div>
              <span className="orb-hint-sep" />
              <div className="orb-hint">
                <span className="hint-icon hint-key">
                  <span className="key-cap">
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <title>Shift key</title>
                      <path d="M7 10 L12 5 L17 10" style={{ stroke: "rgb(0, 0, 0)" }} />
                      <path d="M9 10 L9 18 L15 18 L15 10" style={{ stroke: "rgb(7, 7, 7)" }} />
                    </svg>
                  </span>
                </span>
                <span className="hint-lbl">hold shift</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`compose ${listening ? "compose--listening" : ""}`}
        style={{ marginTop: 28, position: "relative" }}
      >
        <div className="lbl" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>DESCRIBE WHAT YOU&apos;RE LOOKING FOR:</span>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="mono" style={{ color: "var(--ink-4)", fontSize: 10 }}>
            {listening ? "● LISTENING — release SHIFT to stop" : "HOLD SHIFT TO DICTATE"}
          </span>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 3-bed rowhome in Fitler Square under $900k, needs a garage and outdoor space…  —or hold Shift and speak"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();
          }}
        />

        {listening && (
          <div className="dictation-overlay">
            <div className="dict-mic">
              <div className="dict-mic-ring" />🎙
            </div>
            <div className="dict-wave">
              {Array.from({ length: 18 }, (_, i) => i * 0.07).map((delay) => (
                <span key={`d${delay}`} style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
            <div className="dict-time mono">
              {sec}.{tenths}s
            </div>
            <div className="dict-hint mono">TRANSCRIBING · HOLD SHIFT</div>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="attach-strip">
            {attachments.map((a) => {
              const sizeKb =
                a.size > 1024 * 1024
                  ? `${(a.size / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(a.size / 1024))} KB`;
              const glyph = a.kind === "audio" ? "♪" : a.kind === "image" ? "▣" : "⌹";
              return (
                <div key={a.id} className={`attach-chip attach-chip--${a.kind}`}>
                  <span className="attach-glyph">{glyph}</span>
                  <span className="attach-name" title={a.name}>
                    {a.name}
                  </span>
                  <span className="attach-size mono">{sizeKb}</span>
                  <button
                    type="button"
                    className="attach-x"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    aria-label={`Remove ${a.name}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.txt,.md,.pdf,.doc,.docx,.rtf,.png,.jpg,.jpeg,.heic"
            style={{ display: "none" }}
            onChange={onPickFiles}
          />

          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach audio or notes from this device"
          >
            <span className="attach-btn-glyph">+</span>
            <span>Attach</span>
            <span className="attach-btn-kinds mono">AUDIO · DOC</span>
          </button>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="folder-btn"
              onClick={() => setPickerOpen(!pickerOpen)}
              title={selected ? "Change folder" : "Add to client folder"}
            >
              {selected ? (
                <>
                  <span className="attach-btn-glyph">📁</span>
                  <span>{selected.clientName.split(" & ")[0]}</span>
                </>
              ) : (
                <>
                  <span className="attach-btn-glyph">+</span>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>📁</span>
                </>
              )}
              <span className="folder-caret">▾</span>
            </button>
            {pickerOpen && (
              <div
                className="hide-reasons"
                style={{ position: "absolute", right: "auto", left: 0, top: "110%", minWidth: 260 }}
              >
                <div className="q">File this search under…</div>
                <div className="opts">
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="opt"
                      onClick={() => {
                        setTargetFolder(f.id);
                        setPickerOpen(false);
                      }}
                    >
                      <b style={{ fontWeight: 500 }}>{f.clientName}</b>
                      <span style={{ color: "var(--ink-3)", fontSize: 10.5, marginLeft: 8 }}>
                        · {f.tasteHeadline}
                      </span>
                    </button>
                  ))}
                  <button type="button" className="opt" onClick={() => setPickerOpen(false)}>
                    <span style={{ color: "var(--accent)" }}>+ New client folder…</span>
                  </button>
                </div>
                <div className="meta">RE-RANKING USES THE CHOSEN FOLDER&apos;S TASTE VECTOR</div>
              </div>
            )}
          </div>
          <span className="hint mono">⌘ + ENTER to search</span>
          <div className="spacer" />
          <button
            type="button"
            className={`mic-btn ${listening ? "on" : ""}`}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            onTouchStart={(e) => {
              e.preventDefault();
              startListening();
            }}
            onTouchEnd={stopListening}
            title="Hold to dictate (or hold Shift)"
          >
            <span className="mic-dot" />
            <span>{listening ? "Listening…" : "Hold to talk"}</span>
            <span className="kbd">SHIFT</span>
          </button>
          <button type="button" className="run" onClick={go} disabled={!query.trim()}>
            <I.Search />
            Search {selected ? `for ${selected.clientName.split(" ")[0]}` : ""}
            <span className="kbd">⏎</span>
          </button>
        </div>
      </div>

      <div className="section-label">What moved overnight · Pulse</div>
      <div className="pulse-hero">
        {pulse.map((p) => {
          const f = folderMap[p.clientId];
          if (!f) return null;
          return (
            <div
              key={p.clientId}
              className="row"
              onClick={() => router.push(`/folders/${p.clientId}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/folders/${p.clientId}`);
              }}
              // biome-ignore lint/a11y/useSemanticElements: design CSS targets .pulse-hero .row as a flex div; a native button would need UA-style resets that risk visual drift
              role="button"
              tabIndex={0}
            >
              <span className={`dot ${p.tone}`} />
              <div className="client">{f.clientName}</div>
              <div className="ev">{p.label}</div>
              <div className="time mono">{p.time}</div>
              <div className="open">Open →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
