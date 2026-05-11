import { quoteForToday } from "@/lib/motivational-quotes";

interface AgentHeaderProps {
  agentName?: string;
  avatarUrl?: string;
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function AgentHeader({ agentName = "Patrick", avatarUrl }: AgentHeaderProps) {
  const quote = quoteForToday();
  const today = formatToday();

  return (
    <header className="flex items-center justify-between gap-6 px-6 py-4 border-b border-line">
      <div className="flex items-center gap-3 shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={agentName}
            className="w-10 h-10 rounded-full border border-line"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-medium">
            {agentName.charAt(0)}
          </div>
        )}
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
