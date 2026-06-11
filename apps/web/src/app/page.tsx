import { SearchInitiation } from "@/components/home/SearchInitiation";
import { AgentHeader } from "@/components/layout/AgentHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { MOCK_FOLDERS } from "@/lib/mock-data";
import { ensureAgent } from "@/server/agents";

export default async function HomePage() {
  // Auth is enforced by middleware; ensureAgent() guarantees the signed-in
  // user has an agents row even if the Clerk webhook hasn't delivered yet.
  await ensureAgent();

  // TODO Week 2: replace MOCK_FOLDERS with Drizzle query against the
  // authenticated agent's folders.
  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar folders={MOCK_FOLDERS} />
      <div className="flex-1 flex flex-col aurora-wash">
        <AgentHeader />
        <main className="flex-1 flex items-center justify-center px-8 py-12">
          <SearchInitiation folders={MOCK_FOLDERS} />
        </main>
      </div>
    </div>
  );
}
