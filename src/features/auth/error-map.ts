/**
 * Maps Supabase Auth failures to keys in the `auth.errors` i18n namespace.
 * Provider messages are never shown verbatim: they are English-only and can
 * leak implementation detail.
 */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userExists"
  | "weakPassword"
  | "rateLimited"
  | "expiredLink"
  | "callbackFailed"
  | "generic";

const AUTH_ERROR_KEYS: readonly AuthErrorKey[] = [
  "invalidCredentials",
  "emailNotConfirmed",
  "userExists",
  "weakPassword",
  "rateLimited",
  "expiredLink",
  "callbackFailed",
  "generic",
];

/** Guards values taken from the query string before they become i18n keys. */
export function isAuthErrorKey(value: unknown): value is AuthErrorKey {
  return typeof value === "string" && (AUTH_ERROR_KEYS as readonly string[]).includes(value);
}

interface SupabaseLikeError {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

function readError(error: unknown): { message: string; code: string; status: number } {
  if (typeof error === "object" && error !== null) {
    const candidate = error as SupabaseLikeError;
    return {
      message: typeof candidate.message === "string" ? candidate.message.toLowerCase() : "",
      code: typeof candidate.code === "string" ? candidate.code.toLowerCase() : "",
      status: typeof candidate.status === "number" ? candidate.status : 0,
    };
  }
  return { message: typeof error === "string" ? error.toLowerCase() : "", code: "", status: 0 };
}

export function authErrorKey(error: unknown): AuthErrorKey {
  const { message, code, status } = readError(error);

  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered") || message.includes("already been registered")) {
    return "userExists";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "emailNotConfirmed";
  if (code === "weak_password" || message.includes("password should be")) return "weakPassword";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || status === 429 || message.includes("rate limit")) {
    return "rateLimited";
  }
  if (code === "otp_expired" || message.includes("expired") || message.includes("invalid token") || message.includes("token has expired")) {
    return "expiredLink";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalidCredentials";
  if (message.length === 0) return "generic";
  return "generic";
}
