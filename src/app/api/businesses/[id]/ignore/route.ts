import { z } from "zod";

import { ok, withApi } from "@/lib/api/with-api";
import { setBusinessIgnored } from "@/features/businesses/service";

const ignoreSchema = z.object({ ignored: z.boolean() });

/** POST /api/businesses/:id/ignore — hides a business, keeping its audit history. */
export const POST = withApi(
  async ({ ctx, params, body }) => {
    const business = await setBusinessIgnored(ctx, String(params.id), body.ignored);
    return ok(business);
  },
  { body: ignoreSchema },
);
