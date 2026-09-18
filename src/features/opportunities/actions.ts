"use server";

import { revalidatePath } from "next/cache";

import { getWorkspaceContext } from "@/lib/auth/context";

export interface ActionResult {
  ok: boolean;
  error?: { code: string; message: string };
}

/**
 * Re-renders the list pages after a mutation that went through the API routes
 * (ignore, add to pipeline, refresh audit).
 *
 * The mutation itself is never performed here: route handlers already own
 * validation, tenancy and rate limiting. This only invalidates the cached
 * Server Component output so the table reflects the change without a full
 * client-side reload.
 */
export async function revalidateOpportunityLists(): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, error: { code: "unauthorized", message: "No workspace context" } };

  revalidatePath("/opportunities");
  revalidatePath("/businesses");
  return { ok: true };
}
