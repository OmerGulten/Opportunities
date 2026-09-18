# Background Workflows

Scans are long-running: hundreds of provider calls, website fetches and scoring passes. They
run on Vercel Workflows (the `workflow` package) so they are durable, resumable and
observable. Locally the Local World (`.workflow-data/`) is used with no extra setup; on
Vercel the Vercel World is selected automatically once "System Environment Variables" are
enabled, because the runtime needs `VERCEL_DEPLOYMENT_ID`. Inspect runs with
`npx workflow web` or `npx workflow inspect runs`.

## Files

```
src/lib/workflows/
  scan-state.ts              Lifecycle state machine (pure, tested)
  scan/
    scan.workflow.ts         "use workflow": orchestration only, deterministic, no I/O
    refresh.workflow.ts      "use workflow": re-audits a single business on demand
    context.ts               "use step": load scan context, reserve credits
    discovery.ts             "use step": plan coverage, search per cell, deduplicate
    audit.ts                 "use step": list pending, audit + score + bill one business
    finalize.ts              "use step": status transitions, finalize, fail
    filters.ts               Pure scan-result filters (tested)
    shared.ts                Step helpers: admin client, job claims, counters, events
```

Only the two `.workflow.ts` files carry the `"use workflow"` directive. Everything that
touches the database, the providers or the credit ledger is a `"use step"` function.

## Lifecycle

`created -> queued -> discovering -> deduplicating -> auditing -> scoring -> completed | partially_completed | failed | cancelled`

`scans.status` is the single source of truth. Every transition goes through
`canTransition` / `assertScanTransition` in `scan-state.ts`. Invalid transitions are ignored
rather than fatal, so a step that was already in flight cannot resurrect a cancelled scan.

## Step outline

1. **loadScanContext(scanId)** loads the scan with its categories, services, filters and
   workspace locale, resolves settings and feature flags, and moves `created -> queued`.
   A scan that is already terminal returns `proceed: false` so a replayed run exits cleanly.
2. **reserveScanCredits(scanId)** reserves the estimated cost with the fixed key
   `scan:<id>:reserve`. Insufficient balance fails the scan with a `FatalError` rather than
   letting it run up a bill it cannot pay.
3. **planCoverage(scanId)** splits the area into hex-packed coverage cells, writes one
   `scan_targets` row per cell and category, and records the coverage notes. A provider
   search returns at most ~20 results per call, so a large area is swept cell by cell; the
   plan records that this is a sweep, never a census.
4. **discoverCell(scanId, cellIndex, categoryId)** runs the provider search for one cell and
   category, filters results to the polygon or radius, and persists identity
   (`businesses`), the provider payload (`business_provider_snapshots`) and membership
   (`scan_businesses`). The unique constraints make replays idempotent. Provider rate
   limits become `RetryableError` so the runtime backs off.
5. **dedupeScanBusinesses(scanId)** catches the same business listed under different provider
   ids by comparing a normalised name + address + coordinate fingerprint, and marks the later
   memberships as skipped.
6. **listPendingBusinesses(scanId)** returns the ids still to audit.
7. **auditAndScoreBusiness(scanId, businessId, runKey?)** does everything for one business:
   fetch details with the depth-appropriate field mask, persist the snapshot, apply the cheap
   filters, run the audits, persist audits, findings and signals, score against the scan's
   services, persist the opportunity and per-service scores, apply the audit-dependent
   filters, and consume credits. Failures are isolated: the business is marked failed and the
   scan continues. `runKey` lets a manual refresh reuse the same step without colliding with
   the scan's own job or its billing.
8. **finalizeScan(scanId)** decides the final status from the counters, releases the unused
   reservation and records the activity entry.

## Idempotency

* Every credit operation carries a unique key (`creditKeys.*`); the SQL function returns the
  existing ledger row on replay, so a retried step cannot double-charge.
* `scan_jobs.idempotency_key` gates each unit of work. A job that already completed is not
  claimed again.
* Writes use upserts on natural keys (`workspace_id, provider, provider_place_id` for
  businesses; `scan_id, business_id` for membership; `business_id, signal_type` for signals),
  so re-execution converges on the same state.

## Filters and billing

Filters are split in two (`filters.ts`). The cheap checks run on the provider profile before
the expensive website and Instagram work, so an excluded business costs only the discovery
fee. The rest need audit signals and run afterwards, marking the membership as skipped while
keeping the audit data that was already paid for. At `discovery` depth the provider was never
asked for rating, website, hours or photos, so those filters are skipped entirely rather than
treating unknown as missing.

## Cancellation

`POST /api/scans/:id/cancel` sets `status = cancelled`, calls `run.cancel()` on the workflow
run and releases the reservation immediately using the same fixed key the workflow would use,
so doing both is safe. Steps check the scan status before expensive work and exit early.

## Progress

Steps update the `scans` counters through `increment_scan_counters` and append
`scan_job_events`. The UI polls `GET /api/scans/:id` while a scan is active; Supabase Realtime
can be enabled later without changing the data model.

## Retries

Provider and network steps use the Workflow DevKit's retries. Transient conditions raise
`RetryableError` with an exponential `retryAfter` (`attempt^2 * 1000 ms`, capped at 60s) or
the provider's own `Retry-After`. Permanent conditions raise `FatalError` (missing scan,
insufficient credits, invalid business). One business failure never fails the scan.
