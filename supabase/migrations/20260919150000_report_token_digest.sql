-- ============================================================================
-- Remediation pass 2, finding 2: public report tokens were stored in plaintext.
--
-- public_reports.token held the bearer secret verbatim. Anyone who could read
-- the table -- a database backup, a leaked service-role key, an aggregating
-- log, a future read-only integration -- held every live report URL, and those
-- URLs need no session to open. src/lib/security/tokens.ts already had
-- hashToken/verifyToken; the report flow simply never used them, while the
-- api_keys table next door stores a digest and a prefix.
--
-- The token itself must keep travelling in the URL: it is the bearer credential
-- the recipient presents. What changes is that only its digest is kept.
--
-- hashToken() is a SHA-256 hex digest of the UTF-8 token, which is exactly
-- encode(sha256(token::bytea), 'hex'), so existing rows backfill to the same
-- value their raw token produces. No live link breaks.
-- ============================================================================

alter table public.public_reports
  add column if not exists token_hash text,
  add column if not exists token_prefix text;

update public.public_reports
set token_hash = encode(sha256(token::bytea), 'hex'),
    token_prefix = left(token, 12)
where token_hash is null;

alter table public.public_reports
  alter column token_hash set not null;

-- The digest is the lookup key. It is unique because the token is.
create unique index if not exists public_reports_token_hash_key on public.public_reports (token_hash);

-- Non-secret, for listing a link in the interface without revealing it.
create index if not exists public_reports_token_prefix_idx on public.public_reports (token_prefix);

-- The plaintext is what this migration exists to remove.
alter table public.public_reports drop column token;

comment on column public.public_reports.token_hash is
  'SHA-256 hex digest of the bearer token. The token is shown to its creator once and lives only in the URL; it is never stored.';
comment on column public.public_reports.token_prefix is
  'First 12 characters, for identifying a link in listings. Not sufficient to open a report.';


-- ----------------------------------------------------------------------------
-- The view counter looked the row up by plaintext token, so it has to take the
-- digest now. The parameter name changes, which CREATE OR REPLACE cannot do.
-- ----------------------------------------------------------------------------

drop function if exists public.touch_public_report(text);

create or replace function public.touch_public_report(p_token_hash text)
returns void language sql security definer set search_path = public as $$
  update public.public_reports set view_count = view_count + 1, last_viewed_at = now()
  where token_hash = p_token_hash and revoked_at is null and (expires_at is null or expires_at > now());
$$;

-- Recreated, so it needs its privileges set again: this runs under the
-- service-role client on the public report path, never from a session.
revoke execute on function public.touch_public_report(text) from public;
grant execute on function public.touch_public_report(text) to service_role;
