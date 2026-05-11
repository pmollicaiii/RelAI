"use client";

import { useState } from "react";

import type { MockFolder } from "@/lib/mock-data";

type IntakeMode = "type" | "dictate" | "paste" | "upload";

interface SearchInitiationProps {
  folders: MockFolder[];
}

const MODE_LABELS: Record<IntakeMode, string> = {
  type: "Type",
  dictate: "Dictate",
  paste: "Paste",
  upload: "Upload audio",
};

export function SearchInitiation({ folders }: SearchInitiationProps) {
  const [mode, setMode] = useState<IntakeMode>("type");
  const [text, setText] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  // TODO Week 5+7: wire to /api/folders/[id]/searches server action
  // TODO Week 7: wire dictate mode to MediaRecorder + /api/transcribe
  // For now this is the structural UI; submit is a no-op.

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    console.log("[SearchInitiation] submit", { mode, text, selectedFolderId });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl flex flex-col gap-6">
      <div className="flex items-center justify-center">
        <div
          className="orb-breath relative w-32 h-32 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--aurora-a) 0%, var(--aurora-b) 70%, transparent 100%)",
          }}
          aria-hidden
        />
      </div>

      <h1 className="text-center font-serif text-4xl text-ink tracking-tight">
        What would you like to find?
      </h1>

      <div className="surface rounded-2xl shadow-sm p-2 flex flex-col gap-2">
        <div className="flex gap-1 px-2 pt-2">
          {(Object.keys(MODE_LABELS) as IntakeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === m
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-ink-3 hover:text-ink hover:bg-bg-2"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode === "type" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the buyer in plain English — what they want, what they avoid, their budget, neighborhood..."
            rows={6}
            className="w-full px-4 py-3 bg-transparent text-ink placeholder:text-very-quiet focus:outline-none resize-none"
          />
        )}
        {mode === "dictate" && (
          <div className="px-4 py-8 text-center">
            <button
              type="button"
              className="w-16 h-16 rounded-full bg-accent text-white text-2xl hover:opacity-90 transition-opacity"
              aria-label="Start recording"
            >
              ●
            </button>
            <p className="mt-3 text-sm text-quiet">
              Click to start recording. Voice transcription wires in Week 7.
            </p>
          </div>
        )}
        {mode === "paste" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an email, text thread, meeting notes, or anything the buyer wrote/said..."
            rows={8}
            className="w-full px-4 py-3 bg-transparent text-ink placeholder:text-very-quiet focus:outline-none resize-none"
          />
        )}
        {mode === "upload" && (
          <div className="px-4 py-8 text-center border-2 border-dashed border-line rounded-md mx-2 mb-2">
            <p className="text-quiet">Drag a call recording or meeting audio here</p>
            <p className="text-very-quiet text-xs mt-1">.mp3, .wav, .m4a — wires in Week 8</p>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="folder-select" className="text-xs text-quiet font-medium">
            Assign to client folder
          </label>
          <select
            id="folder-select"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-line bg-card text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— New folder —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={text.trim().length === 0 && mode !== "dictate" && mode !== "upload"}
          className="px-5 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Run search →
        </button>
      </div>

      <p className="text-center text-xs text-very-quiet">
        Search hard preferences drive the filter. Soft preferences + your client.md drive
        re-ranking.
      </p>
    </form>
  );
}
