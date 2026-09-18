"use server";

import { revalidatePath } from "next/cache";

import { updateMessageStatusSchema } from "@/features/messages/schemas";
import { updateMessageStatus } from "@/features/messages/service";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { AppError, type ErrorCode } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";

const log = createLogger({ scope: "messages.actions" });

export type MessageActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

async function failure(scope: string, cause: unknown): Promise<MessageActionResult<never>> {
  const t = getT(await getRequestLocale(), "messages");
  if (cause instanceof AppError) {
    log.warn("action_app_error", { scope, code: cause.code });
    return { ok: false, error: { code: cause.code, message: t("toast.failed") } };
  }
  log.error("action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return { ok: false, error: { code: "internal_error", message: t("toast.failed") } };
}

/**
 * Records what the user did with a draft. The app never sends anything, so
 * these statuses (copied / channel opened / archived) are the only record that
 * a draft left the workspace.
 */
export async function setMessageStatusAction(input: { messageId: string; status: string }): Promise<MessageActionResult<{ id: string; status: string }>> {
  const parsed = updateMessageStatusSchema.safeParse(input);
  if (!parsed.success) {
    const t = getT(await getRequestLocale(), "messages");
    return { ok: false, error: { code: "validation_error", message: t("toast.failed") } };
  }

  try {
    const ctx = await requireWorkspaceContext();
    const message = await updateMessageStatus(ctx, parsed.data);
    revalidatePath("/messages");
    return { ok: true, data: { id: message.id, status: message.status } };
  } catch (error) {
    return failure("setMessageStatus", error);
  }
}
