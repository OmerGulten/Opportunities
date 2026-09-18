-- ============================================================================
-- Unlimited credit accounts
--
-- Internal and owner workspaces should be able to run scans without being
-- billed. Granting them a huge balance would work, but it poisons every usage
-- figure (lifetime_granted, the grants chart, "credits remaining") with a
-- number that means nothing.
--
-- Instead an account can be marked `unlimited`. Such an account still records
-- every operation in the ledger, with the real quantity in metadata, so usage
-- reporting stays accurate and auditable — it simply never moves a balance and
-- never fails for want of credits.
--
-- `credit_apply` is deliberately NOT modified: it is the function every paying
-- workspace depends on. The branch lives in a thin wrapper that either
-- short-circuits or delegates to it unchanged.
-- ============================================================================

alter table public.credit_accounts
  add column if not exists unlimited boolean not null default false;

comment on column public.credit_accounts.unlimited is
  'When true, operations are recorded in the ledger but never move the balance and never fail for insufficient credits.';

-- Entry point used by the application. Falls through to `credit_apply` for
-- every normal account, so the billed path is byte-for-byte what it was.
create or replace function public.credit_apply_scoped(
  p_workspace uuid,
  p_type public.credit_ledger_type,
  p_amount integer,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null
)
returns public.credit_ledger language plpgsql security definer set search_path = public as $$
declare
  v_account public.credit_accounts%rowtype;
  v_existing public.credit_ledger%rowtype;
  v_row public.credit_ledger%rowtype;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Same idempotency contract as credit_apply: a replay returns the original
  -- entry and applies nothing.
  select * into v_existing from public.credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_account from public.credit_accounts where workspace_id = p_workspace for update;

  if found and v_account.unlimited then
    -- Informational totals still track real usage; balance and reserved do not move.
    if p_type = 'consumption' then
      update public.credit_accounts
        set lifetime_consumed = lifetime_consumed + p_amount
        where id = v_account.id;
    elsif p_type in ('monthly_grant', 'purchase') then
      update public.credit_accounts
        set lifetime_granted = lifetime_granted + p_amount
        where id = v_account.id;
    end if;

    insert into public.credit_ledger (
      workspace_id, account_id, type, amount, balance_after, reserved_after,
      reference_type, reference_id, idempotency_key, metadata, created_by
    ) values (
      p_workspace, v_account.id, p_type, 0, v_account.balance, v_account.reserved,
      p_reference_type, p_reference_id, p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('unlimited', true), p_actor
    ) returning * into v_row;

    return v_row;
  end if;

  return public.credit_apply(
    p_workspace, p_type, p_amount, p_reference_type, p_reference_id,
    p_idempotency_key, p_metadata, p_actor
  );
end $$;

revoke execute on function public.credit_apply_scoped(uuid, public.credit_ledger_type, integer, text, text, text, jsonb, uuid) from anon, authenticated;

-- Marks a workspace's account unlimited. Platform admins only; the change is
-- recorded in billing_events so it is never a silent grant of free usage.
create or replace function public.set_workspace_unlimited(p_workspace uuid, p_unlimited boolean)
returns public.credit_accounts language plpgsql security definer set search_path = public as $$
declare
  v_account public.credit_accounts%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.credit_accounts (workspace_id, unlimited)
  values (p_workspace, p_unlimited)
  on conflict (workspace_id) do update set unlimited = excluded.unlimited
  returning * into v_account;

  insert into public.billing_events (workspace_id, provider, event_type, external_id, payload, processed_at)
  values (
    p_workspace, 'internal', 'subscription_updated', null,
    jsonb_build_object('unlimited', p_unlimited, 'actor', auth.uid()), now()
  );

  return v_account;
end $$;
