-- ============================================================================
-- Production hardening: provider-derived identity, report retention, cleanup
--
-- Provider-derived business names/addresses/coordinates must not become an
-- indefinite secondary copy of third-party Places content. Keep provider_place_id
-- as the durable identity and leave provider-derived identity material nullable.
--
-- Public reports are provider-derived snapshots too, so they must have a finite
-- lifetime. Existing rows are brought inside the new 30-day ceiling.
-- ============================================================================

alter table public.businesses
  alter column normalized_name drop not null,
  alter column canonical_fingerprint drop not null;

update public.businesses
set normalized_name = null,
    canonical_fingerprint = null
where provider = 'google_places';

comment on column public.businesses.normalized_name is
  'Optional provider-derived normalization. Must remain null for providers that do not allow persistent derived identity data.';
comment on column public.businesses.canonical_fingerprint is
  'Optional ephemeral matching fingerprint. Never populate for providers that prohibit derived identity persistence.';

update public.public_reports
set expires_at = created_at + interval '30 days'
where expires_at is null
   or expires_at > created_at + interval '30 days';

alter table public.public_reports
  alter column expires_at set not null;

alter table public.public_reports
  drop constraint if exists public_reports_expires_at_after_created_at;

alter table public.public_reports
  add constraint public_reports_expires_at_after_created_at
  check (
    expires_at >= created_at
    and expires_at <= created_at + interval '30 days'
  );

comment on column public.public_reports.expires_at is
  'Required finite lifetime for shareable reports. Maximum 30 days while reports may contain provider-derived observations.';

-- Maintenance helper. The route calls this in small batches so a large database
-- is never deleted in one unbounded statement.
create or replace function public.purge_expired_provider_cache(p_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5000), 5000));
  v_deleted integer := 0;
  v_ids uuid[];
begin
  select array_agg(id)
    into v_ids
  from (
    select id
    from public.business_provider_snapshots
    where expires_at <= now()
    order by expires_at
    limit v_limit
  ) s;

  if v_ids is not null and cardinality(v_ids) > 0 then
    delete from public.business_provider_snapshots
    where id = any(v_ids);
    get diagnostics v_deleted = row_count;
  end if;

  return v_deleted;
end;
$$;

revoke execute on function public.purge_expired_provider_cache(integer) from anon, authenticated;
