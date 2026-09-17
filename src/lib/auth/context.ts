import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Locale, WorkspaceRole } from "@/types/common";
import type { ProfileRow, WorkspaceMemberRow, WorkspaceRow } from "@/types/db";

export const CURRENT_WORKSPACE_COOKIE = "oos_ws";
export const LOCALE_COOKIE = "oos_locale";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthContext {
  user: AuthUser;
  profile: ProfileRow;
  supabase: SupabaseClient;
}

export interface WorkspaceContext extends AuthContext {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  membership: WorkspaceMemberRow;
  /** All workspaces the user belongs to (for the switcher). */
  memberships: Array<{ workspace: Pick<WorkspaceRow, "id" | "name" | "slug" | "logo_url">; role: WorkspaceRole }>;
  locale: Locale;
}

/**
 * Resolves the authenticated user from the session cookie. Uses getClaims()
 * (JWT verification) rather than trusting the session blob.
 * Cached per request via React cache().
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub as string;
  const email = (data.claims.email as string | undefined) ?? null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
  if (!profile) {
    // Profile trigger may lag on brand-new accounts; synthesize a minimal profile.
    return {
      user: { id: userId, email },
      profile: {
        id: userId,
        email,
        display_name: email ? email.split("@")[0] : null,
        avatar_url: null,
        locale: "tr",
        is_platform_admin: false,
        default_workspace_id: null,
        onboarding_completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      supabase,
    };
  }
  return { user: { id: userId, email }, profile, supabase };
});

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/**
 * Resolves the current workspace strictly from the user's memberships.
 * The cookie is only a *preference*; it is validated against workspace_members.
 * Returns null when the user has no workspace yet (onboarding).
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const auth = await getAuthContext();
  if (!auth) return null;
  const { supabase, profile, user } = auth;

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(id, name, slug, logo_url, deleted_at)")
    .eq("user_id", user.id)
    .returns<Array<WorkspaceMemberRow & { workspace: Pick<WorkspaceRow, "id" | "name" | "slug" | "logo_url" | "deleted_at"> | null }>>();

  const active = (memberships ?? []).filter((m) => m.workspace && !m.workspace.deleted_at);
  if (active.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(CURRENT_WORKSPACE_COOKIE)?.value ?? profile.default_workspace_id ?? null;
  const chosen = active.find((m) => m.workspace_id === preferred) ?? active[0];

  const { data: workspace } = await supabase.from("workspaces").select("*").eq("id", chosen.workspace_id).maybeSingle<WorkspaceRow>();
  if (!workspace) return null;

  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = localeCookie === "en" || localeCookie === "tr" ? localeCookie : (profile.locale ?? workspace.default_locale ?? "tr");

  return {
    ...auth,
    workspace,
    role: chosen.role,
    membership: chosen,
    memberships: active.map((m) => ({
      workspace: { id: m.workspace!.id, name: m.workspace!.name, slug: m.workspace!.slug, logo_url: m.workspace!.logo_url },
      role: m.role,
    })),
    locale,
  };
});

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    const auth = await getAuthContext();
    if (!auth) throw new UnauthorizedError();
    throw new ForbiddenError("No workspace", { details: { reason: "no_workspace" } });
  }
  return ctx;
}

const ROLE_ORDER: Record<WorkspaceRole, number> = { member: 0, admin: 1, owner: 2 };

export function hasRole(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[minimum];
}

export async function requireRole(minimum: WorkspaceRole): Promise<WorkspaceContext> {
  const ctx = await requireWorkspaceContext();
  if (!hasRole(ctx.role, minimum)) throw new ForbiddenError(`Requires ${minimum} role`);
  return ctx;
}

export async function requirePlatformAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.profile.is_platform_admin) throw new ForbiddenError("Platform admin only");
  return ctx;
}

/** Resolve the effective locale even without a workspace (auth pages, onboarding). */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const c = cookieStore.get(LOCALE_COOKIE)?.value;
  if (c === "en" || c === "tr") return c;
  const auth = await getAuthContext().catch(() => null);
  if (auth?.profile.locale) return auth.profile.locale;
  return (process.env.NEXT_PUBLIC_DEFAULT_LOCALE === "en" ? "en" : "tr") as Locale;
}
