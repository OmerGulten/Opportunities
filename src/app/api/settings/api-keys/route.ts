import { created, ok, withApi } from "@/lib/api/with-api";
import { createApiKeySchema, revokeApiKeySchema } from "@/features/settings/schemas";
import { createApiKey, listApiKeys, revokeApiKey } from "@/features/settings/service";

/** GET /api/settings/api-keys — metadata only; the secret is never retrievable. */
export const GET = withApi(async ({ ctx }) => ok(await listApiKeys(ctx)), { role: "admin" });

/** POST /api/settings/api-keys — returns the plaintext key once, then only its hash is kept. */
export const POST = withApi(
  async ({ ctx, body }) => created(await createApiKey(ctx, body)),
  { body: createApiKeySchema, role: "admin" },
);

export const DELETE = withApi(
  async ({ ctx, body }) => {
    await revokeApiKey(ctx, body.id);
    return ok({ revoked: true });
  },
  { body: revokeApiKeySchema, role: "admin" },
);
