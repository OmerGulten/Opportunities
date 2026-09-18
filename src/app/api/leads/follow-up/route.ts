import { ok, withApi } from "@/lib/api/with-api";
import { scheduleFollowUpSchema } from "@/features/pipeline/schemas";
import { scheduleFollowUp } from "@/features/pipeline/service";

/** POST /api/leads/follow-up — sets or clears a follow-up reminder. Nothing is auto-sent. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const lead = await scheduleFollowUp(ctx, body);
    return ok(lead);
  },
  { body: scheduleFollowUpSchema },
);
