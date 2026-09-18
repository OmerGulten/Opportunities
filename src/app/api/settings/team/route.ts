import { created, ok, withApi } from "@/lib/api/with-api";
import { inviteMemberSchema, removeMemberSchema, updateMemberSchema } from "@/features/settings/schemas";
import { inviteMember, listTeam, removeMember, updateMemberRole } from "@/features/settings/service";

export const GET = withApi(async ({ ctx }) => ok(await listTeam(ctx)));

/** POST /api/settings/team — creates an invitation link. No e-mail is sent in the MVP. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const invitation = await inviteMember(ctx, body);
    return created(invitation);
  },
  { body: inviteMemberSchema, role: "admin" },
);

export const PATCH = withApi(
  async ({ ctx, body }) => {
    await updateMemberRole(ctx, body);
    return ok({ updated: true });
  },
  { body: updateMemberSchema, role: "admin" },
);

export const DELETE = withApi(
  async ({ ctx, body }) => {
    await removeMember(ctx, body);
    return ok({ removed: true });
  },
  { body: removeMemberSchema, role: "admin" },
);
