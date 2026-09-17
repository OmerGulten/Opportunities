import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

import { getAuthContext, getWorkspaceContext, hasRole, type AuthContext, type WorkspaceContext } from "@/lib/auth/context";
import { serverEnv } from "@/lib/config/env";
import { AppError, ForbiddenError, UnauthorizedError, ValidationError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { enforceRateLimit, type RateLimitKey } from "@/lib/rate-limit";
import type { WorkspaceRole } from "@/types/common";

type Params = Record<string, string | string[]>;

export interface ApiHandlerArgs<TBody, TQuery> {
  req: NextRequest;
  params: Params;
  body: TBody;
  query: TQuery;
  ctx: WorkspaceContext;
}

export interface ApiOptions<TBody, TQuery> {
  /** Zod schema for the JSON body (POST/PATCH/PUT). */
  body?: ZodType<TBody>;
  /** Zod schema for URL search params (parsed as an object of strings). */
  query?: ZodType<TQuery>;
  /** Minimum workspace role. Default: member. */
  role?: WorkspaceRole;
  /** Rate-limit bucket (per user). */
  rateLimit?: RateLimitKey;
  /** Allow users without a workspace (onboarding). ctx.workspace will throw if accessed. */
  allowNoWorkspace?: boolean;
}

/**
 * Route Handler wrapper: authenticates, resolves workspace context from the
 * session (never from the client), validates input with Zod, applies rate limits
 * and maps AppErrors to JSON. Use for every /api/* handler except /api/internal
 * (use withInternalApi) and public report endpoints (use withPublicApi).
 */
export function withApi<TBody = unknown, TQuery = Record<string, string>>(
  handler: (args: ApiHandlerArgs<TBody, TQuery>) => Promise<Response | NextResponse>,
  options: ApiOptions<TBody, TQuery> = {},
) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Params> | Params }): Promise<Response> => {
    const started = Date.now();
    try {
      const auth = await getAuthContext();
      if (!auth) throw new UnauthorizedError();

      let ctx: WorkspaceContext | null = await getWorkspaceContext();
      if (!ctx) {
        if (!options.allowNoWorkspace) throw new ForbiddenError("No workspace", { details: { reason: "no_workspace" } });
        ctx = asNoWorkspaceContext(auth);
      } else if (options.role && !hasRole(ctx.role, options.role)) {
        throw new ForbiddenError(`Requires ${options.role} role`);
      }

      if (options.rateLimit) {
        await enforceRateLimit(options.rateLimit, `user:${auth.user.id}`);
      }

      const params = routeCtx?.params ? await routeCtx.params : {};
      const body = await parseBody(req, options.body);
      const query = parseQuery(req, options.query);

      return await handler({ req, params, body: body as TBody, query: query as TQuery, ctx });
    } catch (err) {
      return errorResponse(err, { path: req.nextUrl.pathname, method: req.method, durationMs: Date.now() - started });
    }
  };
}

/** Internal endpoints (cron, workflow callbacks). Requires INTERNAL_API_SECRET bearer token. */
export function withInternalApi<TBody = unknown>(
  handler: (args: { req: NextRequest; params: Params; body: TBody }) => Promise<Response | NextResponse>,
  options: { body?: ZodType<TBody> } = {},
) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Params> | Params }): Promise<Response> => {
    try {
      const secret = serverEnv().INTERNAL_API_SECRET;
      const header = req.headers.get("authorization") ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!secret || !token || !timingSafeEqual(token, secret)) throw new UnauthorizedError("Invalid internal token");
      const params = routeCtx?.params ? await routeCtx.params : {};
      const body = await parseBody(req, options.body);
      return await handler({ req, params, body: body as TBody });
    } catch (err) {
      return errorResponse(err, { path: req.nextUrl.pathname, method: req.method, internal: true });
    }
  };
}

/** Public, unauthenticated endpoints (public reports). Rate-limited by IP. */
export function withPublicApi<TQuery = Record<string, string>>(
  handler: (args: { req: NextRequest; params: Params; query: TQuery }) => Promise<Response | NextResponse>,
  options: { query?: ZodType<TQuery>; rateLimit?: RateLimitKey } = {},
) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Params> | Params }): Promise<Response> => {
    try {
      if (options.rateLimit) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
        await enforceRateLimit(options.rateLimit, `ip:${ip}`);
      }
      const params = routeCtx?.params ? await routeCtx.params : {};
      const query = parseQuery(req, options.query);
      return await handler({ req, params, query: query as TQuery });
    } catch (err) {
      return errorResponse(err, { path: req.nextUrl.pathname, method: req.method, public: true });
    }
  };
}

async function parseBody<T>(req: NextRequest, schema?: ZodType<T>): Promise<T | undefined> {
  if (!schema) return undefined;
  if (req.method === "GET" || req.method === "HEAD") return schema.parse({});
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ValidationError("Body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Invalid request body", { details: { issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } });
  }
  return result.data;
}

function parseQuery<T>(req: NextRequest, schema?: ZodType<T>): T | Record<string, string> {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    const existing = obj[key];
    if (existing === undefined) obj[key] = value;
    else obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  if (!schema) return obj as Record<string, string>;
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters", { details: { issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } });
  }
  return result.data;
}

export function errorResponse(err: unknown, logCtx: Record<string, unknown> = {}): NextResponse {
  const appErr = toAppError(err);
  if (appErr.status >= 500) {
    logger.error("api_error", { ...logCtx, code: appErr.code, message: appErr.message, cause: appErr.cause });
  } else {
    logger.info("api_client_error", { ...logCtx, code: appErr.code, status: appErr.status });
  }
  const body = appErr.status >= 500 && appErr.code === "internal_error"
    ? { error: { code: appErr.code, message: "Internal error", retryable: false } }
    : appErr.toJSON();
  const headers: Record<string, string> = {};
  if (appErr.retryAfterMs) headers["Retry-After"] = String(Math.ceil(appErr.retryAfterMs / 1000));
  return NextResponse.json(body, { status: appErr.status, headers });
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

function asNoWorkspaceContext(auth: AuthContext): WorkspaceContext {
  const proxyTarget = {} as WorkspaceContext;
  return new Proxy(proxyTarget, {
    get(_t, prop) {
      if (prop in auth) return (auth as unknown as Record<string | symbol, unknown>)[prop];
      if (prop === "locale") return auth.profile.locale;
      if (prop === "memberships") return [];
      throw new ForbiddenError("No workspace", { details: { reason: "no_workspace" } });
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export { AppError };
