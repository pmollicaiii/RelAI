"use client";

/**
 * SidebarNav — left rail: logo, Home, client folders, signed-in agent.
 * Faithful port of the design bundle's Sidebar (sidebar.jsx) with the
 * Clerk UserButton replacing the static avatar.
 */

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { RelaiFolder } from "@/lib/relai-data";

interface SidebarNavProps {
  folders: RelaiFolder[];
  agentName: string;
  agentSubtitle?: string | undefined;
}

export function SidebarNav({ folders, agentName, agentSubtitle }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentFolderId = pathname?.startsWith("/folders/")
    ? (pathname.split("/")[2] ?? null)
    : null;

  return (
    <aside className="sidebar">
      <Link href="/" className="brand brand-logo" style={{ width: "100%" }}>
        <Image
          src="/relai-logo.png"
          alt="RelAI"
          width={100}
          height={100}
          unoptimized
          className="brand-logo-img"
          style={{ width: 100, height: 100 }}
        />
      </Link>
      <div className="nav">
        <div className="label">Workspace</div>
        <button
          type="button"
          className={`item ${!currentFolderId ? "active" : ""}`}
          onClick={() => router.push("/")}
        >
          <span className="dot hot" />
          <span className="name">Home</span>
          <span className="count">{folders.length}</span>
        </button>
        <div className="label">Client Folders</div>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`item ${currentFolderId === f.id ? "active" : ""}`}
            onClick={() => router.push(`/folders/${f.id}`)}
          >
            <span className={`dot ${f.pulse}`} />
            <span className="name">{f.clientName.split(" & ")[0]}</span>
            <span className="count">{f.savedCount}</span>
          </button>
        ))}
        <button type="button" className="item" style={{ color: "var(--ink-3)", marginTop: 6 }}>
          <span
            className="dot"
            style={{ background: "transparent", border: "1px dashed var(--ink-4)" }}
          />
          <span className="name">+ New folder</span>
        </button>
      </div>
      <div className="user">
        <UserButton
          appearance={{
            elements: { avatarBox: "w-7 h-7" },
          }}
        />
        <div>
          <div className="nm">{agentName}</div>
          <div className="em">{agentSubtitle ?? "RelAI · Phase 1"}</div>
        </div>
      </div>
    </aside>
  );
}
