-- ============================================================================
-- Security re-audit, 2026-09-19. Five confirmed findings, fixed at the root.
--
-- Each was demonstrated against a live database before this migration was
-- written; tests/security/tenancy.test.ts fails on the previous schema and
-- passes on this one.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. CRITICAL - every SECURITY DEFINER function was executable by anon.
--
-- The schema revoked EXECUTE from `anon, authenticated` on the sensitive
-- functions, but PostgreSQL grants EXECUTE to PUBLIC at creation time and both
-- roles inherit it, so those revokes never took effect. Verified with
-- has_function_privilege(): credit_apply, credit_apply_scoped,
-- increment_scan_counters, rate_limit_hit, touch_public_report and
-- purge_expired_provider_cache were all callable with no session at all.
-- An anonymous caller reached the body of credit_apply, the function that
-- mints credits, and ran purge_expired_provider_cache to completion.
--
-- Fixed by revoking from PUBLIC (the role that actually held it) and granting
-- back only what a session legitimately calls. ALTER DEFAULT PRIVILEGES closes
-- the door on the next function somebody adds: the failure mode was that this
-- list is open by default, and a security control that must be remembered is
-- not a control.
-- ----------------------------------------------------------------------------

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

alter default privileges in schema public revoke execute on functions from public;

-- Referenced by 131 RLS policy expressions, which are evaluated as the calling
-- role: without EXECUTE here every policy in the schema fails closed and the
-- application stops reading its own data.
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

-- Deliberate RPC surface. Each one authorises its own caller internally.
grant execute on function public.create_workspace_with_defaults(text, text) to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;
grant execute on function public.set_workspace_unlimited(uuid, boolean) to authenticated;
grant execute on function public.increment_template_usage(uuid) to authenticated;

-- service_role keeps everything: workflow steps and internal endpoints run as it.
grant execute on all functions in schema public to service_role;


-- ----------------------------------------------------------------------------
-- 2. CRITICAL - any authenticated user could delete any workspace.
--
--   if public.workspace_role(p_workspace) <> 'owner' and not public.is_platform_admin()
--
-- workspace_role() returns NULL when the caller is not a member of that
-- workspace, and `NULL <> 'owner'` is NULL, not true. `NULL and false` is NULL,
-- the IF never fires, and the delete proceeds. The guard therefore protected
-- workspaces the caller belonged to and passed straight through for every
-- workspace they did not -- exactly backwards.
--
-- `is distinct from` is null-safe and yields true for the NULL case.
-- ----------------------------------------------------------------------------

create or replace function public.delete_workspace(p_workspace uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.workspace_role(p_workspace) is distinct from 'owner' and not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.deletion_requests (requested_by, target_type, target_id, status, completed_at)
  values (auth.uid(), 'workspace', p_workspace, 'completed', now());
  update public.profiles set default_workspace_id = null where default_workspace_id = p_workspace;
  delete from public.workspaces where id = p_workspace;
end $$;


-- ----------------------------------------------------------------------------
-- 3. MEDIUM - increment_template_usage was an unauthenticated cross-tenant write.
--
-- SECURITY DEFINER, so it bypassed RLS, and it took an arbitrary template id
-- with no ownership check: any caller could inflate the usage counter of any
-- template in any workspace. It also covers system templates (workspace_id is
-- null), which only the platform owns.
-- ----------------------------------------------------------------------------

create or replace function public.increment_template_usage(p_template uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
begin
  select workspace_id into v_workspace from public.message_templates where id = p_template;
  if not found then
    return; -- Same answer for a missing row as for a forbidden one: no oracle.
  end if;
  -- System templates carry no workspace and are not a tenant's to count.
  if v_workspace is null or not public.is_workspace_member(v_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.message_templates set usage_count = usage_count + 1 where id = p_template;
end $$;

grant execute on function public.increment_template_usage(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. HIGH - scan credit accounting and workflow identity were client-writable.
--
-- scans_update allowed any workspace member to UPDATE any column of their own
-- scans, so a session could set consumed_credits to 0, inflate refunded_credits,
-- mark a running scan completed, or point workflow_run_id at another run. The
-- ledger itself was never writable, but these denormalised columns are what the
-- product reports as usage.
--
-- Table-level UPDATE implies every column, so it is revoked and re-granted per
-- column. What remains is what a person legitimately edits from the interface;
-- everything the server decides is now writable only by service_role.
-- ----------------------------------------------------------------------------

revoke update on public.scans from authenticated;
grant update (name, status, cancelled_at, completed_at) on public.scans to authenticated;


-- ----------------------------------------------------------------------------
-- 5. MEDIUM - provider retention could be defeated from a session.
--
-- public_reports.expires_at was constrained to 30 days by the previous
-- hardening migration, but business_provider_snapshots -- the table that
-- actually holds Google-derived names, addresses and coordinates -- had no
-- bound at all. A member could insert a snapshot expiring in 2099, and
-- purge_expired_provider_cache() would never collect it, quietly turning the
-- cache into the indefinite secondary copy the licence forbids.
--
-- The ceiling mirrors GOOGLE_PLACES_POLICY.cacheTtlHours (30 days), with a day
-- of slack so a clock skew between application and database cannot reject a
-- legitimate write.
-- ----------------------------------------------------------------------------

update public.business_provider_snapshots
set expires_at = fetched_at + interval '30 days'
where expires_at > fetched_at + interval '31 days';

alter table public.business_provider_snapshots
  drop constraint if exists bps_expires_within_retention;

alter table public.business_provider_snapshots
  add constraint bps_expires_within_retention
  check (expires_at > fetched_at and expires_at <= fetched_at + interval '31 days');

comment on constraint bps_expires_within_retention on public.business_provider_snapshots is
  'Provider cache may not outlive the licensed retention window, including when written directly by a session rather than by the workflow.';
