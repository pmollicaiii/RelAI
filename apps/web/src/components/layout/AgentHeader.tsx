import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

import { formatDateLong } from "@/lib/format";
import { quoteForToday } from "@/lib/motivational-quotes";

/**
 * Top strip: Clerk avatar + agent name + date on the left, the day's
 * motivational quote centered, tweaks affordance on the right.
 *
 * Server component — reads the session user directly. The UserButton is
 * Clerk's client island (account menu + sign-out).
 */
export async function AgentHeader() {
  const user = await currentUser();
  const agentName = user?.firstName ?? user?.fullName ?? "Agent";
  const quote = quoteForToday();
  const today = formatDateLong();

  return (
    <header className="flex items-center justify-between gap-6 px-6 py-4 border-b border-line">
      <div className="flex items-center gap-3 shrink-0">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 border border-line",
            },
          }}
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{agentName}</span>
          <span className="text-xs text-very-quiet">{today}</span>
        </div>
      </div>

      <p className="flex-1 hidden md:block text-center font-serif italic text-ink-3 text-lg">
        &ldquo;{quote}&rdquo;
      </p>

      <div className="shrink-0 flex items-center gap-3">
        <button
          type="button"
          className="text-xs text-very-quiet hover:text-ink-2 transition-colors"
          title="Tweaks (mood / pace / voice / density)"
        >
          tweaks
        </button>
      </div>
    </header>
  );
}
