-- Fix: "infinite recursion detected in policy for relation profiles" (SQLSTATE 42P17)
--
-- profiles_update_self guarded against a user granting themselves platform
-- admin by comparing the new is_platform_admin against the stored one:
--
--   with check (id = auth.uid() and is_platform_admin =
--     (select p.is_platform_admin from public.profiles p where p.id = auth.uid()))
--
-- That subquery reads public.profiles from inside a policy on public.profiles,
-- so evaluating the policy re-enters policy evaluation for the same relation
-- and Postgres aborts the statement.
--
-- Nothing caught it earlier because no code path had updated profiles through
-- an RLS-bound client: the admin bootstrap script uses the service-role client,
-- which bypasses RLS. The first real caller was completeOnboarding(), which
-- writes onboarding_completed_at as the signed-in user -- so finishing the
-- onboarding wizard was impossible.
--
-- public.is_platform_admin() answers the same question and is SECURITY DEFINER,
-- so it reads profiles as the function owner, outside RLS, and does not recurse.
-- It resolves auth.uid()'s own flag, which is the value the subquery wanted --
-- and since the policy also requires id = auth.uid(), the row being updated is
-- always the caller's own, so the guard still blocks self-escalation.

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = public.is_platform_admin());
