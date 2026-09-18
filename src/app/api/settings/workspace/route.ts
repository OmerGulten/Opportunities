import { ok, withApi } from "@/lib/api/with-api";
import { deleteWorkspaceSchema, workspaceProfileSchema } from "@/features/settings/schemas";
import { deleteWorkspace, updateWorkspaceProfile } from "@/features/settings/service";

/** PATCH /api/settings/workspace — workspace profile, sender and branding. */
export const PATCH = withApi(
  async ({ ctx, body }) => {
    const workspace = await updateWorkspaceProfile(ctx, body);
    return ok(workspace);
  },
  { body: workspaceProfileSchema, role: "admin" },
);

/** DELETE /api/settings/workspace — irreversible; owner only, name must match. */
export const DELETE = withApi(
  async ({ ctx, body }) => {
    await deleteWorkspace(ctx, body);
    return ok({ deleted: true });
  },
  { body: deleteWorkspaceSchema, role: "owner" },
);
