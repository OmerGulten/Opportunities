import { ok, withApi } from "@/lib/api/with-api";
import { generateMessageSchema } from "@/features/messages/schemas";
import { generateMessage } from "@/features/messages/service";

/**
 * POST /api/messages/generate — drafts outreach text from verified facts.
 * Nothing is sent: the user reviews, edits and opens the channel manually.
 */
export const POST = withApi(
  async ({ ctx, body }) => {
    const result = await generateMessage(ctx, body);
    return ok(result);
  },
  { body: generateMessageSchema, rateLimit: "ai_generate" },
);
