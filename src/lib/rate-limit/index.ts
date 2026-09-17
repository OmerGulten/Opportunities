import "server-only";

import { RateLimitedError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getSystemSetting } from "@/lib/db/settings";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export type RateLimitKey =
  | "scan_create"
  | "ai_generate"
  | "website_audit"
  | "enrichment"
  | "public_report"
  | "auth"
  | "api_default";

export interface RateLimitRule {
  limit: number;
  window_seconds: number;
}

const DEFAULTS: Record<RateLimitKey, RateLimitRule> = {
  scan_create: { limit: 10, window_seconds: 3600 },
  ai_generate: { limit: 60, window_seconds: 3600 },
  website_audit: { limit: 120, window_seconds: 3600 },
  enrichment: { limit: 120, window_seconds: 3600 },
  public_report: { limit: 120, window_seconds: 60 },
  auth: { limit: 20, window_seconds: 600 },
  api_default: { limit: 600, window_seconds: 60 },
};

// In-memory fallback for local dev without service role / for tests.
const memory = new Map<string, { count: number; windowStart: number }>();

function memoryHit(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.windowStart + rule.window_seconds * 1000 <= now) {
    memory.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= rule.limit;
}

export async function getRateLimitRule(key: RateLimitKey): Promise<RateLimitRule> {
  const rules = await getSystemSetting<Partial<Record<RateLimitKey, RateLimitRule>>>("rate_limits", {});
  const rule = rules?.[key];
  if (rule && typeof rule.limit === "number" && typeof rule.window_seconds === "number") return rule;
  return DEFAULTS[key];
}

/**
 * Fixed-window rate limit. `subject` is e.g. `user:<id>` or `ip:<addr>`.
 * Throws RateLimitedError when exceeded.
 */
export async function enforceRateLimit(key: RateLimitKey, subject: string): Promise<void> {
  const rule = await getRateLimitRule(key);
  const bucketKey = `${key}:${subject}`;
  let allowed: boolean;
  if (isAdminClientConfigured()) {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: bucketKey,
      p_limit: rule.limit,
      p_window_seconds: rule.window_seconds,
    });
    if (error) {
      logger.warn("rate_limit_rpc_failed", { key, error: error.message });
      allowed = memoryHit(bucketKey, rule);
    } else {
      allowed = Boolean(data);
    }
  } else {
    allowed = memoryHit(bucketKey, rule);
  }
  if (!allowed) {
    throw new RateLimitedError("Too many requests, please slow down", {
      retryAfterMs: rule.window_seconds * 1000,
      details: { key, limit: rule.limit, windowSeconds: rule.window_seconds },
    });
  }
}

/** Test helper */
export function resetMemoryRateLimits() {
  memory.clear();
}
