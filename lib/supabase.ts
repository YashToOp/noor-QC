"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RULE ZERO — one Supabase project.
 *
 * These two values are copied verbatim from the Majlis Flutter build
 * (`lib/config.dart`) and are identical in Sharik. Noor Core creates no
 * project, runs no migration and defines no table: it reads and writes the
 * schema that already exists. See docs/13-integration-contract.md.
 */
// Read at module scope so Next.js can inline them into the client bundle —
// `process.env.NEXT_PUBLIC_*` is substituted at build time, not looked up at
// runtime, so it must appear as a static property access.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * Singleton browser client. One socket, shared by every realtime subscription.
 *
 * The missing-config check lives here rather than at module scope on purpose:
 * a throw at import time fires during `next build`, while pages are being
 * prerendered, and takes the whole build down with a stack trace that says
 * nothing about the real problem. Failing on first use instead surfaces it in
 * the card's error state, where §5.10 says a failed fetch belongs.
 */
export function supabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy them from .env.example — they must match the Flutter apps exactly.",
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
