import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { appUrl } from "@/lib/config/env";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { generateApiKey, generateSecureToken } from "@/lib/security/tokens";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { WorkspaceRole } from "@/types/common";
import type { ApiKeyRow, ServiceOfferingRow, WorkspaceMemberRow, WorkspaceRow } from "@/types/db";

import type {
  CreateApiKeyRequest,
  DeleteWorkspaceRequest,
  InviteMemberRequest,
  OfferingRequest,
  RemoveMemberRequest,
  UpdateMemberRequest,
  UpdateOfferingRequest,
  WorkspaceProfileRequest,
  WorkspaceServicesRequest,
} from "./schemas";

/** Workspace profile, team, services, offerings, API keys and deletion. */

export async function updateWorkspaceProfile(ctx: WorkspaceContext, request: WorkspaceProfileRequest): Promise<WorkspaceRow> {
  const patch: Record<string, unknown> = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.defaultLocale !== undefined) patch.default_locale = request.defaultLocale;
  if (request.defaultTone !== undefined) patch.default_tone = request.defaultTone;
  if (request.senderName !== undefined) patch.sender_name = request.senderName;
  if (request.senderTitle !== undefined) patch.sender_title = request.senderTitle;
  if (request.senderPhone !== undefined) patch.sender_phone = request.senderPhone;
  if (request.senderEmail !== undefined) patch.sender_email = request.senderEmail;
  if (request.companyName !== undefined) patch.company_name = request.companyName;
  if (request.companyWebsite !== undefined) patch.company_website = request.companyWebsite;
  if (request.companyDescription !== undefined) patch.company_description = request.companyDescription;
  if (request.brandPrimaryColor !== undefined) patch.brand_primary_color = request.brandPrimaryColor;
  if (request.logoUrl !== undefined) patch.logo_url = request.logoUrl;

  const { data, error } = await ctx.supabase.from("workspaces").update(patch).eq("id", ctx.workspace.id).select("*").single<WorkspaceRow>();
  if (error || !data) throw toAppError(error ?? new Error("Workspace could not be updated"));
  return data;
}

// ---------------------------------------------------------------------------
// team
// ---------------------------------------------------------------------------

export interface TeamMember {
  userId: string;
  role: WorkspaceRole;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
}

interface MemberProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export async function listTeam(ctx: WorkspaceContext): Promise<TeamMember[]> {
  const { data, error } = await ctx.supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("joined_at")
    .returns<Array<Pick<WorkspaceMemberRow, "user_id" | "role" | "joined_at">>>();
  if (error) throw toAppError(error);
  const members = data ?? [];
  if (members.length === 0) return [];

  // Fetched separately rather than embedded: workspace_members.user_id
  // references auth.users, which PostgREST does not expose, so there is no
  // relationship it can follow -- and none to public.profiles either. Asking
  // for the embed answers PGRST200 and takes the whole page down with it.
  // Reading these rows is what the profiles_select_coworkers policy is for.
  const { data: profileRows, error: profileError } = await ctx.supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .in("id", members.map((member) => member.user_id))
    .returns<MemberProfile[]>();
  if (profileError) throw toAppError(profileError);
  const profiles = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));

  return members.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      userId: row.user_id,
      role: row.role,
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      joinedAt: row.joined_at,
      isOwner: row.user_id === ctx.workspace.owner_id,
    };
  });
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  inviteUrl: string;
}

/**
 * Creates an invitation and returns its link.
 *
 * The MVP does not send e-mail: the inviter copies the link and shares it. That
 * keeps the flow honest about what actually happens rather than implying a
 * message was sent.
 */
export async function inviteMember(ctx: WorkspaceContext, request: InviteMemberRequest): Promise<PendingInvitation> {
  const plan = await planLimits(ctx);
  const team = await listTeam(ctx);
  if (plan.maxMembers > 0 && team.length >= plan.maxMembers) {
    throw new ConflictError("This plan's member limit has been reached", { details: { maxMembers: plan.maxMembers } });
  }

  const token = generateSecureToken(24);
  const { data, error } = await ctx.supabase
    .from("workspace_invitations")
    .insert({ workspace_id: ctx.workspace.id, email: request.email.toLowerCase(), role: request.role, token, invited_by: ctx.user.id })
    .select("id, email, role, expires_at")
    .single<{ id: string; email: string; role: WorkspaceRole; expires_at: string }>();
  if (error || !data) throw toAppError(error ?? new Error("Invitation could not be created"));

  return { id: data.id, email: data.email, role: data.role, expiresAt: data.expires_at, inviteUrl: appUrl(`/invite/${token}`) };
}

export async function updateMemberRole(ctx: WorkspaceContext, request: UpdateMemberRequest): Promise<void> {
  if (request.userId === ctx.workspace.owner_id && request.role !== "owner") {
    throw new ValidationError("Transfer ownership before changing the owner's role");
  }
  if (request.role === "owner" && ctx.role !== "owner") {
    throw new ForbiddenError("Only the owner can grant ownership");
  }
  const { error } = await ctx.supabase.from("workspace_members").update({ role: request.role }).eq("workspace_id", ctx.workspace.id).eq("user_id", request.userId);
  if (error) throw toAppError(error);
}

export async function removeMember(ctx: WorkspaceContext, request: RemoveMemberRequest): Promise<void> {
  if (request.userId === ctx.workspace.owner_id) throw new ValidationError("The workspace owner cannot be removed");
  const { error } = await ctx.supabase.from("workspace_members").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", request.userId);
  if (error) throw toAppError(error);
}

// ---------------------------------------------------------------------------
// services and offerings
// ---------------------------------------------------------------------------

export async function setWorkspaceServices(ctx: WorkspaceContext, request: WorkspaceServicesRequest): Promise<void> {
  const { data: services } = await ctx.supabase.from("services").select("id").eq("active", true).returns<{ id: string }[]>();
  const valid = new Set((services ?? []).map((service) => service.id));
  const selected = request.serviceIds.filter((id) => valid.has(id));

  const rows = [...valid].map((serviceId) => ({
    workspace_id: ctx.workspace.id,
    service_id: serviceId,
    enabled: selected.includes(serviceId),
  }));

  const { error } = await ctx.supabase.from("workspace_services").upsert(rows, { onConflict: "workspace_id,service_id" });
  if (error) throw toAppError(error);
}

export async function listOfferings(ctx: WorkspaceContext): Promise<ServiceOfferingRow[]> {
  const { data, error } = await ctx.supabase
    .from("service_offerings")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("sort_order")
    .returns<ServiceOfferingRow[]>();
  if (error) throw toAppError(error);
  return data ?? [];
}

export async function createOffering(ctx: WorkspaceContext, request: OfferingRequest): Promise<ServiceOfferingRow> {
  assertPriceRange(request.priceFrom ?? null, request.priceTo ?? null);
  const { data, error } = await ctx.supabase
    .from("service_offerings")
    .insert({
      workspace_id: ctx.workspace.id,
      service_id: request.serviceId,
      name: request.name,
      description: request.description ?? null,
      price_from: request.priceFrom ?? null,
      price_to: request.priceTo ?? null,
      currency: request.currency,
      billing_period: request.billingPeriod,
      delivery_time: request.deliveryTime ?? null,
      prompt_context: request.promptContext ?? null,
      enabled: request.enabled,
      sort_order: request.sortOrder,
    })
    .select("*")
    .single<ServiceOfferingRow>();
  if (error || !data) throw toAppError(error ?? new Error("Offering could not be created"));
  return data;
}

export async function updateOffering(ctx: WorkspaceContext, request: UpdateOfferingRequest): Promise<ServiceOfferingRow> {
  assertPriceRange(request.priceFrom ?? null, request.priceTo ?? null);
  const patch: Record<string, unknown> = {};
  if (request.serviceId !== undefined) patch.service_id = request.serviceId;
  if (request.name !== undefined) patch.name = request.name;
  if (request.description !== undefined) patch.description = request.description;
  if (request.priceFrom !== undefined) patch.price_from = request.priceFrom;
  if (request.priceTo !== undefined) patch.price_to = request.priceTo;
  if (request.currency !== undefined) patch.currency = request.currency;
  if (request.billingPeriod !== undefined) patch.billing_period = request.billingPeriod;
  if (request.deliveryTime !== undefined) patch.delivery_time = request.deliveryTime;
  if (request.promptContext !== undefined) patch.prompt_context = request.promptContext;
  if (request.enabled !== undefined) patch.enabled = request.enabled;
  if (request.sortOrder !== undefined) patch.sort_order = request.sortOrder;

  const { data, error } = await ctx.supabase
    .from("service_offerings")
    .update(patch)
    .eq("id", request.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .maybeSingle<ServiceOfferingRow>();
  if (error) throw toAppError(error);
  if (!data) throw new NotFoundError("Offering not found");
  return data;
}

export async function deleteOffering(ctx: WorkspaceContext, offeringId: string): Promise<void> {
  const { error } = await ctx.supabase.from("service_offerings").delete().eq("id", offeringId).eq("workspace_id", ctx.workspace.id);
  if (error) throw toAppError(error);
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  /** Shown once at creation; only the hash is stored. */
  key: string;
}

export async function listApiKeys(ctx: WorkspaceContext): Promise<ApiKeyRow[]> {
  const { data, error } = await ctx.supabase
    .from("api_keys")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .returns<ApiKeyRow[]>();
  if (error) throw toAppError(error);
  return data ?? [];
}

export async function createApiKey(ctx: WorkspaceContext, request: CreateApiKeyRequest): Promise<CreatedApiKey> {
  const generated = generateApiKey();
  const { data, error } = await ctx.supabase
    .from("api_keys")
    .insert({
      workspace_id: ctx.workspace.id,
      name: request.name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      scopes: request.scopes,
      created_by: ctx.user.id,
    })
    .select("id, name, key_prefix")
    .single<{ id: string; name: string; key_prefix: string }>();
  if (error || !data) throw toAppError(error ?? new Error("API key could not be created"));

  // The plaintext key is returned once and never stored.
  return { id: data.id, name: data.name, prefix: data.key_prefix, key: generated.key };
}

export async function revokeApiKey(ctx: WorkspaceContext, id: string): Promise<void> {
  const { error } = await ctx.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) throw toAppError(error);
}

// ---------------------------------------------------------------------------
// deletion
// ---------------------------------------------------------------------------

/** Deletes the workspace and everything cascading from it. Owner only. */
export async function deleteWorkspace(ctx: WorkspaceContext, request: DeleteWorkspaceRequest): Promise<void> {
  if (ctx.role !== "owner") throw new ForbiddenError("Only the workspace owner can delete it");
  if (request.confirmName.trim() !== ctx.workspace.name.trim()) {
    throw new ValidationError("The confirmation name does not match this workspace");
  }
  const { error } = await ctx.supabase.rpc("delete_workspace", { p_workspace: ctx.workspace.id });
  if (error) throw toAppError(error);
  logger.info("workspace_deleted", { workspaceId: ctx.workspace.id, actor: ctx.user.id });
}

/**
 * Deletes the signed-in user's account.
 *
 * Workspaces they solely own are removed with them; workspaces they merely
 * belong to lose only their membership. Requires the service-role client,
 * because removing the auth user is not something a user session can do.
 */
export async function deleteAccount(ctx: WorkspaceContext): Promise<void> {
  if (!isAdminClientConfigured()) throw new ConflictError("Account deletion is not configured on this deployment");
  const admin = createAdminClient();

  const { data: owned } = await admin.from("workspaces").select("id").eq("owner_id", ctx.user.id).is("deleted_at", null).returns<{ id: string }[]>();
  for (const workspace of owned ?? []) {
    const { count } = await admin.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id);
    // Keep shared workspaces alive; only solo ones go with the account.
    if ((count ?? 0) <= 1) await admin.from("workspaces").delete().eq("id", workspace.id);
  }

  await admin.from("workspace_members").delete().eq("user_id", ctx.user.id);
  await admin.from("deletion_requests").insert({ requested_by: ctx.user.id, target_type: "account", target_id: ctx.user.id, status: "completed", completed_at: new Date().toISOString() });

  const { error } = await admin.auth.admin.deleteUser(ctx.user.id);
  if (error) throw toAppError(error);
  logger.info("account_deleted", { userId: ctx.user.id });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function planLimits(ctx: WorkspaceContext): Promise<{ maxMembers: number }> {
  if (!ctx.workspace.plan_id) return { maxMembers: 0 };
  const { data } = await ctx.supabase.from("plans").select("max_members").eq("id", ctx.workspace.plan_id).maybeSingle<{ max_members: number }>();
  return { maxMembers: data?.max_members ?? 0 };
}

function assertPriceRange(from: number | null, to: number | null): void {
  if (from !== null && to !== null && from > to) {
    throw new ValidationError("The starting price cannot be higher than the top price");
  }
}
