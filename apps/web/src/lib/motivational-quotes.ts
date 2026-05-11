/**
 * Day-deterministic motivational quote for the top-margin strip on the Home page.
 *
 * Picks a quote based on date so it's stable for the whole day. Pool of ~30
 * agent-flavored quotes — short, premium, no clutter.
 */

export const QUOTES = [
  "The best clients write their own profiles — you just have to listen.",
  "Show your work. Win the trust.",
  "Quiet street, big yard, near schools — the wedge is the listening.",
  "Every preference traces back to a quote.",
  "Match isn't search. Match is judgment.",
  "Soft preferences shape what wins; hard ones shape what's possible.",
  "Read the room. Then read the listing.",
  "The packet they read three times is the one they tour.",
  "Provenance over polish.",
  "Suck less today than yesterday.",
  "Verifier > generator.",
  "Multimodal is fundamental, not optional.",
  "Cache aggressively. Trust the gate.",
  "Centroids drift. That's the wisdom.",
  "Hard prefs filter. Soft prefs sort.",
  "Show 247. Rank 20. Trust the agent.",
  "The buyer never sees 'steer.'",
  "Capability over feature. Composition over heroics.",
  "Slug, label, weight, polarity, quote.",
  "The orb listens; you decide.",
  "Listening compounds.",
  "Every search teaches the model your client.",
  "An honest essence doc is worth a hundred remarks.",
  "Walk-in closets and quiet streets — same chip taxonomy.",
  "Top 20 ranked, all 247 visible.",
  "Pull and push, green and red.",
  "Five passes, one source quote each.",
  "Fair Housing at the boundary. Honest preferences inside.",
  "Photos when Bright unlocks. Until then, listen harder.",
  "The wedge is the client.md.",
];

/**
 * Returns the quote for today (UTC date). Stable per day.
 */
export function quoteForToday(now: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getUTCFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return QUOTES[dayOfYear % QUOTES.length] ?? QUOTES[0] ?? "Listen.";
}
