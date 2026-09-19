"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishableKey } from "@/lib/config/env";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client (publishable key only). Singleton per tab. */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publishableKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
