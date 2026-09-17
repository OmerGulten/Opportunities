# Background Workflows

Scans are long-running (hundreds of provider calls, website fetches, scoring). They run on
Vercel Workflows (Workflow DevKit, the `workflow` npm package) so they are durable,
resumable and observable. Locally the Local World (`.workflow-data/`) is used with no extra
setup; on Vercel the Vercel World is used automatically once "System Environment Variables"
are enabled (the runtime needs `VERCEL_DEPLOYMENT_ID`). Inspect runs with
`npx workflow web` or `npx workflow inspect runs`.

## Files

```
src/lib/workflows/
  scan.workflow.ts        "use workflow": orchestration only, deterministic
  steps/
    load-scan.ts          "use step": load scan + workspace + config
    reserve-credits.ts    reserve estimated credits (idempotent)
    discover.ts           run provider search per coverage cell / category
    dedupe.ts             dedupe by provider place_id and canonical fingerprint
    persist-discovery.ts  upsert businesses, snapshots, scan_businesses
    audit-business.ts     per-business audit fan-out (website / google / instagram / performance)
    score-business.ts     signals -> service scores -> opportunity rows
    progress.ts           update counters, emit scan_job_events, consume credits
    finalize.ts           complete / partially_complete / fail, refund unused reservation
```

## Lifecycle

`created -> queued -> discovering -> deduplicating -> enriching -> auditing -> scoring -> completed | partially_completed | failed | cancelled`

`scans.status` is the single source of truth. Transitions are validated by
`assertScanTransition(from, to)` in `lib/workflows/scan-state.ts` (tested).

## Step outline

1. **loadScan(scanId)**: loads the scan, its categories, services, filters, workspace and
   pricing rules. Throws `FatalError` if the scan is missing or already terminal.
2. **reserveCredits**: `CreditService.reserve()` with idempotency key `scan:<id>:reserve`.
   Fails the scan with `InsufficientCredits` if the balance is short.
3. **discover**: for each `scan_targets` cell x category, call `PlaceProvider.searchBusinesses`.
   Each cell is its own step attempt; provider rate limits throw `RetryableError` with
   `retryAfter`. Results accumulate in `scan_targets.results_count` and coverage metadata.
4. **dedupe**: dedupe by `(provider, provider_place_id)` then by `canonical_fingerprint`;
   polygon scans filter points outside the polygon (Turf).
5. **persistDiscovery**: upsert `businesses` (identity), insert `business_provider_snapshots`,
   insert `scan_businesses` with `discovery_position`, `matched_category`. Idempotent via
   unique constraints (`scan_id, business_id`).
6. **auditBusiness(scanBusinessId)** (fan-out, bounded concurrency): fetches details with the
   depth-appropriate field mask, runs Google Business audit, website audit (safeFetchUrl +
   cheerio), performance provider (deep only), Instagram discovery. Writes
   `business_audits`, `audit_findings`, `opportunity_signals`. Sets
   `scan_businesses.audit_status`. Failure marks that business `failed` and continues.
7. **scoreBusiness**: loads active `service_rules` for the scan's services, evaluates them
   against signals, writes `opportunities` + `opportunity_scores`, sets
   `opportunity_status`. Consumes the per-business credit cost (`scan:<id>:business:<bid>`).
8. **finalize**: computes final status (`completed` if no failures, `partially_completed`
   if some failed, `failed` if discovery failed), refunds unused reservation, records
   `lead_activities` (scan completed), updates counters.

## Idempotency

* Every credit operation has a unique `idempotency_key`; the SQL function returns the existing
  ledger row on replay.
* `scan_jobs.idempotency_key` (`scan:<scanId>:audit:<businessId>`) prevents processing a
  business twice for the same scan.
* Steps are written so re-execution after a crash produces the same DB state (upserts on
  natural keys).

## Cancellation

`POST /api/scans/:id/cancel` sets `status = cancelled` and calls `run.cancel()` on the
workflow run (`scans.workflow_run_id`). Steps check `scans.status` before expensive work and
exit early when cancelled. Finalization refunds the unused reservation.

## Progress

Steps update `scans.*_count` columns and append `scan_job_events`. The UI polls
`GET /api/scans/:id` every few seconds while the scan is active (Supabase Realtime can be
enabled later without changing the data model).

## Retries

Provider and network steps use Workflow DevKit retries (default 3) with `RetryableError`
(`retryAfter` exponential: `attempt^2 * 1000 ms`, capped) for rate limits/timeouts and
`FatalError` for permanent conditions (invalid business, cancelled scan, insufficient
credits). One business failure never fails the scan.
