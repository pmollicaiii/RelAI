/**
 * Public client view (mobile-first, no auth).
 *
 * Buyers receive a slug+HMAC link from the agent's packet share. Tapping a
 * heart / dismiss / tour-request creates a `packet_event` row, which flows
 * into `client_reactions` (buyer stream) and refines the client.md (CLAUDE.md §6.12).
 *
 * V1 scaffold: mock listings render with mobile-first card stack +
 * heart/no-thanks tap targets. Wire to /api/p/[slug] in Week 11 of plan.
 */

import { PublicListingStack } from "@/components/public/PublicListingStack";
import { MOCK_LISTINGS } from "@/lib/mock-data";

interface PublicPacketPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicPacketPage({ params }: PublicPacketPageProps) {
  const { slug } = await params;
  // TODO Week 6: validate slug HMAC + fetch real packet from DB.
  // For now: render mock listings so the page is testable.
  void slug;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="px-6 py-5 border-b border-line">
        <p className="font-serif text-2xl text-ink">RelAI</p>
        <p className="text-xs text-quiet">A handpicked set from your agent.</p>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6 max-w-2xl mx-auto w-full">
        <PublicListingStack listings={MOCK_LISTINGS.slice(0, 3)} />
      </main>
      <footer className="px-6 py-4 text-xs text-very-quiet text-center">
        Powered by RelAI · relai.realty
      </footer>
    </div>
  );
}
