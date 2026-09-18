import { z } from "zod";

import { created, ok, withApi } from "@/lib/api/with-api";
import { offeringSchema, updateOfferingSchema } from "@/features/settings/schemas";
import { createOffering, deleteOffering, listOfferings, updateOffering } from "@/features/settings/service";

export const GET = withApi(async ({ ctx }) => ok(await listOfferings(ctx)));

export const POST = withApi(
  async ({ ctx, body }) => created(await createOffering(ctx, body)),
  { body: offeringSchema, role: "admin" },
);

export const PATCH = withApi(
  async ({ ctx, body }) => ok(await updateOffering(ctx, body)),
  { body: updateOfferingSchema, role: "admin" },
);

export const DELETE = withApi(
  async ({ ctx, body }) => {
    await deleteOffering(ctx, body.id);
    return ok({ deleted: true });
  },
  { body: z.object({ id: z.uuid() }), role: "admin" },
);
