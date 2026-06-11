/**
 * Agent provisioning — the auth → agents-row bridge.
 *
 * `ensureAgent()` is called by every authenticated server page/action. If
 * the signed-in Clerk user has no `agents` row yet (webhook hasn't fired,
 * failed, or is still retrying), one is created on the spot.
 *
 * The Clerk webhook (/api/webhooks/clerk) remains the primary sync path —
 * it keeps email + name fresh on user.updated. This fallback guarantees
 * provisioning is never blocked by webhook delivery timing.
 */

import { currentUser } from "@clerk/nextjs/server";
import { agents, db, eq } from "@relai/db";

export type AgentRow = typeof agents.$inferSelect;

/**
 * Returns the agents row for the signed-in user, creating it if missing.
 * Returns null when there is no authenticated user (caller should have
 * been protected by middleware already — null is a belt-and-suspenders
 * guard, not an expected path).
 */
export async function ensureAgent(): Promise<AgentRow | null> {
  const user = await currentUser();
  if (!user) return null;

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  const existing = await db.select().from(agents).where(eq(agents.clerkUserId, user.id)).limit(1);
  if (existing[0]) {
    // Refresh stale identity fields (e.g. row provisioned before the user
    // filled in their Clerk profile, or webhook delivery lagged an update).
    const staleName = name !== null && existing[0].name !== name;
    const staleEmail = primaryEmail !== undefined && existing[0].email !== primaryEmail;
    if (staleName || staleEmail) {
      const refreshed = await db
        .update(agents)
        .set({
          ...(staleName ? { name } : {}),
          ...(staleEmail ? { email: primaryEmail } : {}),
          updatedAt: new Date(),
        })
        .where(eq(agents.clerkUserId, user.id))
        .returning();
      return refreshed[0] ?? existing[0];
    }
    return existing[0];
  }

  if (!primaryEmail) {
    console.warn(`[ensureAgent] Clerk user ${user.id} has no email; cannot provision`);
    return null;
  }

  const inserted = await db
    .insert(agents)
    .values({ clerkUserId: user.id, email: primaryEmail, name })
    .onConflictDoUpdate({
      target: agents.clerkUserId,
      set: { email: primaryEmail, name, updatedAt: new Date() },
    })
    .returning();

  console.log(`[ensureAgent] provisioned agents row for ${user.id}`);
  return inserted[0] ?? null;
}
