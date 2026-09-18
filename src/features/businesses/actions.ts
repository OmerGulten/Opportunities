"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getWorkspaceContext } from "@/lib/auth/context";

export interface ActionResult {
  ok: boolean;
  error?: { code: string; message: string };
}

const businessIdSchema = z.uuid();

/**
 * Re-renders the business profile (and the lists that link to it) after a
 * mutation that went through the API routes.
 *
 * The id is validated before it reaches `revalidatePath`, and the caller must
 * have a workspace context; the action performs no reads or writes of its own.
 */
export async function revalidateBusinessDetail(businessId: string): Promise<ActionResult> {
  const parsed = businessIdSchema.safeParse(businessId);
  if (!parsed.success) return { ok: false, error: { code: "validation_error", message: "Invalid business id" } };

  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: false, error: { code: "unauthorized", message: "No workspace context" } };

  revalidatePath(`/businesses/${parsed.data}`);
  revalidatePath("/businesses");
  revalidatePath("/opportunities");
  return { ok: true };
}
