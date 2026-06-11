import { notFound } from "next/navigation";

import { FolderView } from "@/components/relai/FolderView";
import { SidebarNav } from "@/components/relai/SidebarNav";
import {
  ACTIVE_CHIPS,
  AMBIGUITY,
  ARTIFACTS,
  CHIP_CATEGORIES,
  CHIP_LIBRARY,
  EXTRACTED_CRITERIA,
  FOLDERS,
  LISTINGS,
  PREFERENCE_LEDGER,
  PROFILE_EVENTS,
  getFolder,
} from "@/lib/relai-data";
import { ensureAgent } from "@/server/agents";

interface FolderPageProps {
  params: Promise<{ id: string }>;
}

export default async function FolderPage({ params }: FolderPageProps) {
  const { id } = await params;
  const agent = await ensureAgent();
  const agentName = agent?.name ?? "Agent";

  // TODO Week 2: replace with Drizzle query scoped to the agent.
  const folder = getFolder(id);
  if (!folder) notFound();

  return (
    <div className="app">
      <SidebarNav
        folders={FOLDERS}
        agentName={agentName}
        agentSubtitle={agent?.email ?? undefined}
      />
      <main className="main">
        <FolderView
          folder={folder}
          data={{
            listings: LISTINGS,
            ambiguity: AMBIGUITY,
            extractedCriteria: EXTRACTED_CRITERIA,
            preferenceLedger: PREFERENCE_LEDGER,
            chipLibrary: CHIP_LIBRARY,
            activeChips: ACTIVE_CHIPS,
            chipCategories: CHIP_CATEGORIES,
            artifacts: ARTIFACTS,
            profileEvents: PROFILE_EVENTS,
          }}
        />
      </main>
    </div>
  );
}
