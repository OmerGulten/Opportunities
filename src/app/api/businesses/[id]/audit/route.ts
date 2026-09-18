import { ok, withApi } from "@/lib/api/with-api";
import { refreshBusinessAudit } from "@/features/businesses/service";

/** POST /api/businesses/:id/audit — re-runs the audit as a durable workflow. */
export const POST = withApi(
  async ({ ctx, params }) => {
    const result = await refreshBusinessAudit(ctx, String(params.id));
    return ok(result);
  },
  { rateLimit: "website_audit" },
);
