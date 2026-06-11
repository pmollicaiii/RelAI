/**
 * Clerk auth middleware.
 *
 * Default-deny: every route requires a session EXCEPT the public surface:
 *   - /sign-in, /sign-up — Clerk's hosted auth pages
 *   - /p/[slug]          — public packet links (buyers tap these from SMS/email; no account)
 *   - /api/webhooks/*    — vendor callbacks (Clerk, later Resend) verified by signature, not session
 *   - /api/inngest       — Inngest Cloud function invocations, verified by INNGEST_SIGNING_KEY
 *
 * CLAUDE.md §6: the public packet link's HMAC slug is its own auth; never
 * put Clerk in front of it.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/p/(.*)",
  "/api/webhooks/(.*)",
  "/api/inngest(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets; run on everything else + API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
