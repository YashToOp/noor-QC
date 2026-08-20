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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy them from .env.example — they must match the Flutter apps exactly.",
  );
}

let client: SupabaseClient | null = null;

/** Singleton browser client. One socket, shared by every realtime subscription. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
