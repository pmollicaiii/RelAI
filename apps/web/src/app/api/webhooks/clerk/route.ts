/**
 * Clerk webhook — keeps the `agents` table in sync with Clerk users.
 *
 * Events handled:
 *   - user.created  → upsert agents row (clerk_user_id is the conflict key)
 *   - user.updated  → upsert (refreshes email + name)
 *   - user.deleted  → no-op + log. Deleting the agents row would cascade-wipe
 *                     every folder/search/packet they own; V1 keeps the data
 *                     and revokes access at the Clerk layer instead.
 *
 * Verification: svix signature headers against CLERK_WEBHOOK_SECRET. Any
 * failure → 400 with no detail (don't help attackers probe).
 */

import type { WebhookEvent } from "@clerk/nextjs/server";
import { agents, db } from "@relai/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env["CLERK_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[webhooks/clerk] CLERK_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const body = await req.text();

  let evt: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const u = evt.data;
      const primaryEmail =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses?.[0]?.email_address;
      if (!primaryEmail) {
        console.warn(`[webhooks/clerk] ${evt.type} for ${u.id} has no email; skipping`);
        return NextResponse.json({ ok: true });
      }
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;

      await db
        .insert(agents)
        .values({
          clerkUserId: u.id,
          email: primaryEmail,
          name,
        })
        .onConflictDoUpdate({
          target: agents.clerkUserId,
          set: {
            email: primaryEmail,
            name,
            updatedAt: new Date(),
          },
        });

      console.log(`[webhooks/clerk] ${evt.type} → agents upsert for ${u.id}`);
      return NextResponse.json({ ok: true });
    }

    case "user.deleted": {
      // Intentional no-op (see file header). Access is already revoked at
      // the Clerk layer; the agents row + their folders stay for V1.
      console.log(
        `[webhooks/clerk] user.deleted for ${evt.data.id ?? "unknown"} — no-op by design`,
      );
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: true });
  }
}
