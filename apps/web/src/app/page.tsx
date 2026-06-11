import { HomeView } from "@/components/relai/HomeView";
import { SidebarNav } from "@/components/relai/SidebarNav";
import { FOLDERS, PULSE } from "@/lib/relai-data";
import { ensureAgent } from "@/server/agents";

export default async function HomePage() {
  // Auth is enforced by middleware; ensureAgent() guarantees the signed-in
  // user has an agents row even if the Clerk webhook hasn't delivered yet.
  const agent = await ensureAgent();
  const agentName = agent?.name ?? "Agent";
  const firstName = agentName.split(" ")[0] ?? "there";

  // TODO Week 2: replace FOLDERS/PULSE with Drizzle queries scoped to the agent.
  return (
    <div className="app">
      <SidebarNav
        folders={FOLDERS}
        agentName={agentName}
        agentSubtitle={agent?.email ?? undefined}
      />
      <main className="main">
        <HomeView folders={FOLDERS} pulse={PULSE} agentFirstName={firstName} />
      </main>
    </div>
  );
}
