"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { MockFolder } from "@/lib/mock-data";

interface SidebarProps {
  folders: MockFolder[];
}

export function Sidebar({ folders }: SidebarProps) {
  const pathname = usePathname();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? folders.filter(
        (f) =>
          f.displayName.toLowerCase().includes(filter.toLowerCase()) ||
          f.shorthand.toLowerCase().includes(filter.toLowerCase()),
      )
    : folders;

  return (
    <aside
      className="flex flex-col gap-3 h-full w-72 px-4 py-6 border-r border-line bg-bg-2/50"
      aria-label="Client folders"
    >
      <Link
        href="/"
        className="font-serif text-2xl tracking-tight text-ink hover:text-accent transition-colors mb-2"
      >
        RelAI
      </Link>

      <button
        type="button"
        className="flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <span className="text-lg leading-none">+</span>
        <span>New folder</span>
      </button>

      <div className="mt-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter folders..."
          className="w-full px-3 py-1.5 rounded-md border border-line bg-card text-sm placeholder:text-very-quiet focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <nav className="flex flex-col gap-1 mt-2 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-very-quiet text-sm px-3 py-2">No matching folders.</p>
        )}
        {filtered.map((f) => {
          const href = `/folders/${f.id}`;
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={f.id}
              href={href}
              className={`flex flex-col gap-0.5 px-3 py-2 rounded-md transition-colors ${
                isActive ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-bg-2 hover:text-ink"
              }`}
            >
              <span className="text-sm font-medium truncate">{f.displayName}</span>
              <span className="text-xs text-very-quiet truncate">{f.shorthand}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto text-xs text-very-quiet">
        <p>
          <span className="font-mono">v0.1</span> · <span>aurora mood</span>
        </p>
      </div>
    </aside>
  );
}
