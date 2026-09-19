import { z } from "zod";

/**
 * Environment access. Two layers:
 *  - publicEnv: NEXT_PUBLIC_* values, safe for the browser (inlined at build time).
 *  - serverEnv(): server-only secrets. Importing this module in a Client Component
 *    is prevented by `server-only` in ./server-env.ts; use that wrapper in server code.
 *
 * Parsing is lazy and cached so `next build` does not fail when optional
 * credentials are missing (demo mode).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["tr", "en"]).default("tr"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().min(1).optional(),
});

/**
 * The browser-safe Supabase key.
 *
 * Supabase renamed this from "anon" to "publishable", and the Vercel–Supabase
 * integration still provisions `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Accepting either
 * means a project wired up by that integration works untouched, instead of
 * needing the same value stored twice under two names.
 *
 * Both names are referenced literally: `NEXT_PUBLIC_*` is inlined at build time
 * by matching the literal text, so a computed lookup would silently produce
 * `undefined` in the browser.
 */
export function publishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

// NEXT_PUBLIC_ variables must be referenced literally so Next.js can inline them.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey(),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || undefined,
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  GOOGLE_PAGESPEED_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  DEMO_MODE: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  INTERNAL_API_SECRET: z.string().min(16).optional(),
  BILLING_PROVIDER: z.enum(["mock"]).default("mock"),
  FEATURE_REAL_PAYMENTS: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Server-only. Do not call from Client Components. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || undefined,
    GOOGLE_PAGESPEED_API_KEY: process.env.GOOGLE_PAGESPEED_API_KEY || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
    DEMO_MODE: process.env.DEMO_MODE ?? "",
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || undefined,
    BILLING_PROVIDER: process.env.BILLING_PROVIDER || undefined,
    FEATURE_REAL_PAYMENTS: process.env.FEATURE_REAL_PAYMENTS ?? "",
    LOG_LEVEL: process.env.LOG_LEVEL || undefined,
    NODE_ENV: process.env.NODE_ENV || undefined,
    VERCEL_ENV: process.env.VERCEL_ENV || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper */
export function resetServerEnvCache() {
  cached = null;
}

export interface DemoFlags {
  places: boolean;
  ai: boolean;
  pagespeed: boolean;
  /** True if any provider runs in demo mode (drives the "Demo data" indicator). */
  any: boolean;
  forced: boolean;
}

/** Which providers run in demo mode. Missing credentials => demo. DEMO_MODE=true forces all. */
export function getDemoFlags(): DemoFlags {
  const env = serverEnv();
  const forced = env.DEMO_MODE === true;
  const places = forced || !env.GOOGLE_PLACES_API_KEY;
  const ai = forced || !env.OPENAI_API_KEY;
  const pagespeed = forced || !env.GOOGLE_PAGESPEED_API_KEY;
  return { places, ai, pagespeed, any: places || ai || pagespeed, forced };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isProduction(): boolean {
  return serverEnv().NODE_ENV === "production";
}

export function appUrl(path = ""): string {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
