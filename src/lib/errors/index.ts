/**
 * Typed application errors. Every external integration and every service throws
 * one of these (or wraps unknown errors with `toAppError`). Route handlers map
 * them to JSON responses; the UI maps `code` to a localized message via the
 * `errors` i18n namespace. Stack traces never reach users.
 */

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "rate_limited"
  | "insufficient_credits"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_error"
  | "invalid_business"
  | "website_timeout"
  | "website_blocked"
  | "website_too_large"
  | "website_invalid_url"
  | "ai_unavailable"
  | "ai_invalid_output"
  | "workflow_failed"
  | "scan_invalid_transition"
  | "demo_mode_restriction"
  | "feature_disabled"
  | "internal_error";

export interface AppErrorOptions {
  status?: number;
  details?: Record<string, unknown>;
  retryable?: boolean;
  cause?: unknown;
  /** Suggested retry delay for rate limits (ms). */
  retryAfterMs?: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.details = options.details;
    this.retryable = options.retryable ?? defaultRetryable(code);
    this.retryAfterMs = options.retryAfterMs;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details ?? undefined,
        retryable: this.retryable,
      },
    };
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
    case "demo_mode_restriction":
    case "feature_disabled":
      return 403;
    case "not_found":
      return 404;
    case "validation_error":
    case "website_invalid_url":
    case "invalid_business":
    case "scan_invalid_transition":
      return 400;
    case "conflict":
      return 409;
    case "insufficient_credits":
      return 402;
    case "rate_limited":
    case "provider_rate_limited":
      return 429;
    case "provider_unavailable":
    case "ai_unavailable":
      return 503;
    case "website_timeout":
      return 504;
    case "website_blocked":
    case "website_too_large":
    case "ai_invalid_output":
    case "provider_error":
    case "workflow_failed":
      return 502;
    default:
      return 500;
  }
}

function defaultRetryable(code: ErrorCode): boolean {
  return (
    code === "rate_limited" ||
    code === "provider_rate_limited" ||
    code === "provider_unavailable" ||
    code === "ai_unavailable" ||
    code === "website_timeout"
  );
}

// Convenience subclasses -----------------------------------------------------

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", options?: AppErrorOptions) {
    super("unauthorized", message, options);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource", options?: AppErrorOptions) {
    super("forbidden", message, options);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", options?: AppErrorOptions) {
    super("not_found", message, options);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", options?: AppErrorOptions) {
    super("validation_error", message, options);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", options?: AppErrorOptions) {
    super("conflict", message, options);
    this.name = "ConflictError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests", options?: AppErrorOptions) {
    super("rate_limited", message, options);
    this.name = "RateLimitedError";
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number, options?: AppErrorOptions) {
    super("insufficient_credits", "Insufficient credits", {
      ...options,
      details: { required, available, ...(options?.details ?? {}) },
    });
    this.name = "InsufficientCreditsError";
  }
}

export class ProviderRateLimitedError extends AppError {
  constructor(provider: string, options?: AppErrorOptions) {
    super("provider_rate_limited", `${provider} rate limit reached`, { ...options, details: { provider, ...(options?.details ?? {}) } });
    this.name = "ProviderRateLimitedError";
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(provider: string, options?: AppErrorOptions) {
    super("provider_unavailable", `${provider} is unavailable`, { ...options, details: { provider, ...(options?.details ?? {}) } });
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, message: string, options?: AppErrorOptions) {
    super("provider_error", `${provider}: ${message}`, { ...options, details: { provider, ...(options?.details ?? {}) } });
    this.name = "ProviderError";
  }
}

export class InvalidBusinessError extends AppError {
  constructor(message = "Business is invalid or no longer available", options?: AppErrorOptions) {
    super("invalid_business", message, options);
    this.name = "InvalidBusinessError";
  }
}

export class WebsiteTimeoutError extends AppError {
  constructor(url: string, options?: AppErrorOptions) {
    super("website_timeout", "Website did not respond in time", { ...options, details: { url, ...(options?.details ?? {}) } });
    this.name = "WebsiteTimeoutError";
  }
}

export class WebsiteBlockedError extends AppError {
  constructor(reason: string, options?: AppErrorOptions) {
    super("website_blocked", `Website fetch blocked: ${reason}`, { ...options, details: { reason, ...(options?.details ?? {}) } });
    this.name = "WebsiteBlockedError";
  }
}

export class WebsiteInvalidUrlError extends AppError {
  constructor(reason: string, options?: AppErrorOptions) {
    super("website_invalid_url", `Invalid website URL: ${reason}`, { ...options, details: { reason, ...(options?.details ?? {}) } });
    this.name = "WebsiteInvalidUrlError";
  }
}

export class WebsiteTooLargeError extends AppError {
  constructor(limitBytes: number, options?: AppErrorOptions) {
    super("website_too_large", "Website response exceeded the size limit", { ...options, details: { limitBytes, ...(options?.details ?? {}) } });
    this.name = "WebsiteTooLargeError";
  }
}

export class AIUnavailableError extends AppError {
  constructor(message = "AI provider is unavailable", options?: AppErrorOptions) {
    super("ai_unavailable", message, options);
    this.name = "AIUnavailableError";
  }
}

export class AIInvalidOutputError extends AppError {
  constructor(message = "AI output failed validation", options?: AppErrorOptions) {
    super("ai_invalid_output", message, options);
    this.name = "AIInvalidOutputError";
  }
}

export class WorkflowFailedError extends AppError {
  constructor(message = "Background workflow failed", options?: AppErrorOptions) {
    super("workflow_failed", message, options);
    this.name = "WorkflowFailedError";
  }
}

export class ScanInvalidTransitionError extends AppError {
  constructor(from: string, to: string, options?: AppErrorOptions) {
    super("scan_invalid_transition", `Cannot move scan from ${from} to ${to}`, { ...options, details: { from, to } });
    this.name = "ScanInvalidTransitionError";
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string, options?: AppErrorOptions) {
    super("feature_disabled", `Feature "${feature}" is disabled`, { ...options, details: { feature } });
    this.name = "FeatureDisabledError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError || (typeof err === "object" && err !== null && "code" in err && "status" in err && err instanceof Error);
}

/** Wrap unknown errors. Postgres/Supabase errors get mapped where recognisable. */
export function toAppError(err: unknown, fallbackMessage = "Something went wrong"): AppError {
  if (isAppError(err)) return err;
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; message?: string; details?: string; status?: number };
    // PostgREST / Postgres error codes
    if (e.code === "P0001" && (e.message?.includes("insufficient_credits") || e.details?.includes("available="))) {
      const m = /available=(\d+) required=(\d+)/.exec(e.details ?? "");
      return new InsufficientCreditsError(m ? Number(m[2]) : 0, m ? Number(m[1]) : 0, { cause: err });
    }
    if (e.code === "42501") return new ForbiddenError(undefined, { cause: err });
    if (e.code === "23505") return new ConflictError("Duplicate record", { cause: err });
    if (e.code === "PGRST116") return new NotFoundError(undefined, { cause: err });
    if (e.code === "22P02" || e.code === "23502" || e.code === "23514") return new ValidationError(e.message ?? "Invalid input", { cause: err });
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return new AppError("internal_error", message || fallbackMessage, { cause: err });
}
