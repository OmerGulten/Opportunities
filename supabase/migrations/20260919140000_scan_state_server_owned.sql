-- ============================================================================
-- Remediation pass 2, finding 1: scans.status was still client-writable.
--
-- The previous pass revoked table-level UPDATE and granted back
-- (name, status, cancelled_at, completed_at). That still let a session drive
-- the whole state machine by hand. Demonstrated against the live database: a
-- session moved its own scan to completed, queued, failed and cancelled in
-- turn, every one accepted.
--
-- The earlier regression test missed it because it set a credit column and
-- status in one statement: Postgres rejects the whole UPDATE for the column it
-- lacks privilege on, so status never moved and the test passed for the wrong
-- reason. A status-only UPDATE succeeds. The test now asserts each column on
-- its own.
--
-- Why it matters: status drives billing and the workflow. Marking a scan
-- `completed` ends it without the work being done; `failed` reaches the refund
-- path; `queued` re-presents a finished scan as pending. The TypeScript state
-- machine in lib/workflows/scan-state.ts is authoritative, and a direct table
-- write goes around it entirely.
-- ============================================================================

revoke update on public.scans from authenticated;

-- `name` is the only field on a scan a person actually edits.
grant update (name) on public.scans to authenticated;


-- ----------------------------------------------------------------------------
-- Cancellation still has to be possible from the interface, so it moves to a
-- function that enforces what the table no longer can: membership, and a
-- transition the state machine actually allows.
--
-- The status check lives in the UPDATE's WHERE clause rather than in a prior
-- SELECT, so two concurrent cancels cannot both observe a cancellable row and
-- both write. The second one matches nothing and reports the conflict.
-- ----------------------------------------------------------------------------

create or replace function public.request_scan_cancellation(p_scan uuid)
returns public.scans language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
  v_row public.scans%rowtype;
begin
  select workspace_id into v_workspace from public.scans where id = p_scan;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.is_workspace_member(v_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Mirrors isCancellable(): every state that lists 'cancelled' as a legal
  -- successor in TRANSITIONS. Terminal states are absent on purpose.
  update public.scans
  set status = 'cancelled', cancelled_at = now(), completed_at = now()
  where id = p_scan
    and status in ('created', 'queued', 'discovering', 'deduplicating', 'enriching', 'auditing', 'scoring')
  returning * into v_row;

  if not found then
    raise exception 'scan_invalid_transition' using errcode = '55000';
  end if;

  return v_row;
end $$;

revoke execute on function public.request_scan_cancellation(uuid) from public;
grant execute on function public.request_scan_cancellation(uuid) to authenticated, service_role;

comment on function public.request_scan_cancellation(uuid) is
  'The only path by which a session may change scans.status. Enforces workspace membership and a legal transition; the status guard is in the UPDATE predicate so concurrent cancels serialise.';
