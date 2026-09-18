/**
 * Thin client-side wrapper around the outreach API routes.
 *
 * Route handlers answer with `{ data }` or `{ error: { code, message, details } }`
 * (see lib/api/with-api.ts). The UI never shows the raw server message: it maps
 * `code` through the `errors` i18n namespace, so this helper only has to carry
 * the code and the details along.
 */

export interface ApiFailure {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

const NETWORK_FAILURE: ApiFailure = { code: "internal_error", message: "network_error" };

async function request<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_FAILURE };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: ApiFailure } | null)?.error;
    return { ok: false, error: error ?? { code: "internal_error", message: `http_${response.status}` } };
  }

  return { ok: true, data: (payload as { data: T }).data };
}

export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, "POST", body);
}

export function patchJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, "PATCH", body);
}

/** Reads `{ required, available }` off an insufficient_credits failure. */
export function creditShortfall(error: ApiFailure): { required: number; available: number } | null {
  const required = error.details?.required;
  const available = error.details?.available;
  if (typeof required !== "number" || typeof available !== "number") return null;
  return { required, available };
}
