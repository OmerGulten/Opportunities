-- ============================================================================
-- Remediation pass 2, finding 3: the pass-1 hardening did not hold for new
-- functions.
--
-- Pass 1 revoked EXECUTE from PUBLIC and added
--
--   alter default privileges in schema public revoke execute on functions from public;
--
-- believing that closed the door on functions added later. It did not. Supabase
-- installs its own default privileges granting EXECUTE on new functions in
-- `public` to anon, authenticated and service_role. Those are direct grants to
-- the roles, not the PUBLIC grant, so revoking PUBLIC leaves them untouched.
--
-- Both functions created in this pass were therefore anon-executable the moment
-- they existed, including one written in the same migration that revoked
-- PUBLIC from it:
--
--   request_scan_cancellation(uuid)  auth=true anon=true
--   touch_public_report(text)        auth=true anon=true
--
-- Found by a regression test asserting the view counter was not callable from a
-- session, which failed. The static reading of the previous migration said the
-- door was shut; the database said otherwise.
-- ============================================================================

-- Counter Supabase's defaults for anything added from here on.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

-- Close the two functions this pass introduced.
revoke execute on function public.touch_public_report(text) from public, anon, authenticated;
revoke execute on function public.request_scan_cancellation(uuid) from public, anon, authenticated;

-- Read by the anonymous public-report path, but through the service-role client,
-- never from a session.
grant execute on function public.touch_public_report(text) to service_role;

-- The one deliberate session-callable addition: it authorises its own caller.
grant execute on function public.request_scan_cancellation(uuid) to authenticated, service_role;

-- Re-assert the whole surface, in case anything else was created since pass 1
-- and picked up the same default grant.
do $$
declare
  fn record;
  allowed text[] := array[
    'is_platform_admin', 'is_workspace_member', 'is_workspace_admin', 'workspace_role',
    'create_workspace_with_defaults', 'delete_workspace', 'set_workspace_unlimited',
    'increment_template_usage', 'request_scan_cancellation'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    if fn.proname = any (allowed) then
      execute format('grant execute on function %s to authenticated', fn.sig);
    end if;
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;
