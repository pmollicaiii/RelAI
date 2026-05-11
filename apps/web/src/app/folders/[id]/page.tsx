import { notFound } from "next/navigation";

import { FolderTabs } from "@/components/folder/FolderTabs";
import { AgentHeader } from "@/components/layout/AgentHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { MOCK_FOLDERS } from "@/lib/mock-data";

interface FolderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ surface?: string }>;
}

export default async function FolderPage({ params, searchParams }: FolderPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  // TODO Week 1: replace mock with Drizzle query.
  const folder = MOCK_FOLDERS.find((f) => f.id === id);
  if (!folder) notFound();

  const surface = sp.surface === "outreach" || sp.surface === "profile" ? sp.surface : "search";

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar folders={MOCK_FOLDERS} />
      <div className="flex-1 flex flex-col">
        <AgentHeader />
        <FolderTabs folder={folder} initialSurface={surface} />
      </div>
    </div>
  );
}
