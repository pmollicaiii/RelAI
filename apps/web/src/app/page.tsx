import { SearchInitiation } from "@/components/home/SearchInitiation";
import { AgentHeader } from "@/components/layout/AgentHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { MOCK_FOLDERS } from "@/lib/mock-data";

export default function HomePage() {
  // TODO Week 1: wire Clerk auth — redirect to /sign-in if no session.
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
