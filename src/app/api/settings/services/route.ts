import { ok, withApi } from "@/lib/api/with-api";
import { workspaceServicesSchema } from "@/features/settings/schemas";
import { setWorkspaceServices } from "@/features/settings/service";

/** PUT /api/settings/services — which services this workspace sells. */
export const PUT = withApi(
  async ({ ctx, body }) => {
    await setWorkspaceServices(ctx, body);
    return ok({ updated: true });
  },
  { body: workspaceServicesSchema, role: "admin" },
);
