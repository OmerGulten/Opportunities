/**
 * Structured JSON logger with redaction. Works in Node and edge runtimes.
 * Never log secrets, full prompts or full outreach message bodies in production.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
  "apiKey",
  "x-goog-api-key",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "service_role_key",
  "secret",
  "openai_api_key",
  "google_places_api_key",
  "supabase_service_role_key",
  "body", // outreach bodies / raw prompts
  "prompt",
]);

export type LogContext = Record<string, unknown>;

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : "info";
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: (value as { code?: string }).code };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

export interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  child(ctx: LogContext): Logger;
}

function emit(level: LogLevel, base: LogContext, message: string, ctx?: LogContext) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;
  const record = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(redact(base) as Record<string, unknown>),
    ...(ctx ? (redact(ctx) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(base: LogContext = {}): Logger {
  return {
    debug: (m, c) => emit("debug", base, m, c),
    info: (m, c) => emit("info", base, m, c),
    warn: (m, c) => emit("warn", base, m, c),
    error: (m, c) => emit("error", base, m, c),
    child: (ctx) => createLogger({ ...base, ...ctx }),
  };
}

export const logger = createLogger({ app: "opportunityos" });
