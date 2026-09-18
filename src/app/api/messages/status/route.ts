import { ok, withApi } from "@/lib/api/with-api";
import { updateMessageStatusSchema } from "@/features/messages/schemas";
import { updateMessageStatus } from "@/features/messages/service";

/** PATCH /api/messages/status — records copy / channel-open, the manual-send signals. */
export const PATCH = withApi(
  async ({ ctx, body }) => {
    const message = await updateMessageStatus(ctx, body);
    return ok(message);
  },
  { body: updateMessageStatusSchema },
);
