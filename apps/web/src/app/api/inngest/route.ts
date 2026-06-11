/**
 * Inngest serve endpoint. Inngest Cloud calls this URL to discover +
 * invoke functions. Authentication is the INNGEST_SIGNING_KEY signature
 * — the route is public in Clerk middleware terms (no session).
 */

import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
