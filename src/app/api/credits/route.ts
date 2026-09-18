import { ok, withApi } from "@/lib/api/with-api";
import { toAppError } from "@/lib/errors";

/** GET /api/credits — current balance and reservation for the workspace. */
export const GET = withApi(async ({ ctx }) => {
  const { data, error } = await ctx.supabase
    .from("credit_accounts")
    .select("balance, reserved, lifetime_granted, lifetime_consumed")
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ balance: number; reserved: number; lifetime_granted: number; lifetime_consumed: number }>();
  if (error) throw toAppError(error);
  return ok({
    available: data?.balance ?? 0,
    reserved: data?.reserved ?? 0,
    lifetimeGranted: data?.lifetime_granted ?? 0,
    lifetimeConsumed: data?.lifetime_consumed ?? 0,
  });
});
