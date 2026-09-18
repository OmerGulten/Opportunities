import "server-only";

import { logger } from "@/lib/logging";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { PublicReportRow } from "@/types/db";

import { reportTokenSchema } from "./schemas";
import type { ReportSnapshot } from "./types";

export interface PublicReportView {
  title: string;
  snapshot: ReportSnapshot;
  branding: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
}

export type PublicReportLookup =
  | { status: "ok"; report: PublicReportView }
  | { status: "not_found" }
  | { status: "revoked" }
  | { status: "expired" };

/**
 * Resolves a public report by token for an anonymous viewer.
 *
 * Read with the service-role client because there is no session, so the token
 * itself is the authorisation: it is validated for shape first, only the
 * curated snapshot columns are selected, and revoked or expired links are
 * reported as such rather than rendered. No workspace or CRM data is returned.
 */
export async function getPublicReport(rawToken: string): Promise<PublicReportLookup> {
  const parsed = reportTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { status: "not_found" };
  if (!isAdminClientConfigured()) return { status: "not_found" };

  const client = createAdminClient();
  const { data, error } = await client
    .from("public_reports")
    .select("title, content_snapshot, branding, created_at, expires_at, revoked_at")
    .eq("token", parsed.data)
    .maybeSingle<Pick<PublicReportRow, "title" | "content_snapshot" | "branding" | "created_at" | "expires_at" | "revoked_at">>();

  if (error) {
    logger.error("public_report_lookup_failed", { error: error.message });
    return { status: "not_found" };
  }
  if (!data) return { status: "not_found" };
  if (data.revoked_at) return { status: "revoked" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return { status: "expired" };

  // View counting is best effort and must never block rendering.
  void client.rpc("touch_public_report", { p_token: parsed.data }).then(
    () => undefined,
    (err: unknown) => logger.warn("public_report_touch_failed", { error: String(err) }),
  );

  return {
    status: "ok",
    report: {
      title: data.title,
      snapshot: data.content_snapshot as unknown as ReportSnapshot,
      branding: data.branding,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    },
  };
}
