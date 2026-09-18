import type { ErrorCode } from "@/lib/errors";

/**
 * Browser-side calls to the existing route handlers.
 *
 * Mutations from list rows and from the business profile go through the same
 * API the rest of the product uses, so tenancy, rate limits and credit
 * accounting are enforced server-side exactly once. Failures are surfaced as an
 * `ApiError` carrying the server's error *code*, which the UI maps through the
 * `errors` i18n namespace instead of showing a raw message.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown };
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    // Network-level failure: no server code to map, so fall back to the generic one.
    throw new ApiError("internal_error", "Request failed", 0);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope;
    const code = typeof envelope.error?.code === "string" ? envelope.error.code : "internal_error";
    const message = typeof envelope.error?.message === "string" ? envelope.error.message : "Request failed";
    throw new ApiError(code, message, response.status);
  }

  return (payload as { data: T })?.data;
}

/** POST /api/businesses/:id/ignore */
export async function requestSetIgnored(businessId: string, ignored: boolean): Promise<void> {
  await request<unknown>(`/api/businesses/${businessId}/ignore`, {
    method: "POST",
    body: JSON.stringify({ ignored }),
  });
}

/** POST /api/businesses/:id/audit — queues the durable refresh workflow. */
export async function requestRefreshAudit(businessId: string): Promise<void> {
  await request<unknown>(`/api/businesses/${businessId}/audit`, { method: "POST" });
}

/** POST /api/leads — adds the business to the pipeline's first stage. */
export async function requestAddToPipeline(businessId: string, primaryServiceId?: string | null): Promise<void> {
  await request<unknown>("/api/leads", {
    method: "POST",
    body: JSON.stringify({ businessId, primaryServiceId: primaryServiceId ?? null }),
  });
}

/** POST /api/leads/notes */
export async function requestAddNote(leadId: string, body: string): Promise<void> {
  await request<unknown>("/api/leads/notes", {
    method: "POST",
    body: JSON.stringify({ leadId, body }),
  });
}

/**
 * The `errors` namespace is keyed by ErrorCode; anything else (or a translator
 * miss) falls back to the generic sentence rather than showing a raw code.
 */
export function errorMessage(error: unknown, t: (key: string) => string): string {
  const code = error instanceof ApiError ? error.code : "internal_error";
  const translated = t(code as ErrorCode);
  return translated === code ? t("generic") : translated;
}
