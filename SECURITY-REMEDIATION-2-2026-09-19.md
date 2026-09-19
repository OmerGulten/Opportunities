# Security Remediation Pass 2 — 19 September 2026

Branch `security/remediation-2-2026-09-19`, based on `security/re-audit-2026-09-19`.
Master untouched at `4b49b068`.

---

## 1. Executive summary

Six findings confirmed, six fixed. Two of them are defects **in the previous pass's own
work**, which is the main reason this round was worth running:

- `scans.status` remained client-writable after pass 1 "fixed" it, and pass 1's regression
  test passed for the wrong reason — it bundled a privileged column into the same UPDATE, so
  Postgres rejected the whole statement and status never moved.
- Pass 1 claimed `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM PUBLIC` closed the door on
  functions added later. It did not. Supabase installs its own default privileges granting
  EXECUTE to `anon` and `authenticated` directly, so **both functions created during this
  pass were anon-executable the moment they existed** — including one in the very migration
  that revoked PUBLIC from it.

Both were caught by tests, not by reading. That is the lesson of this pass.

**There is also a live production regression that I caused in pass 1** (§19). It is the most
urgent item in this document.

---

## 2. Previous audit findings — re-verified

| Pass-1 claim | Status now |
|---|---|
| All SECURITY DEFINER functions anon-executable | Fixed, **but incompletely** — see §6.2 |
| `delete_workspace` null-comparison bypass | Holds. Re-tested L4 |
| Scan credit columns client-writable | Holds for credits, **failed for `status`** — see §6.1 |
| `increment_template_usage` unauthorised | Holds. Re-tested L4 |
| Snapshot retention unbounded | Holds. Re-tested L4 |
| Report tokens plaintext | **Now fixed** — §8 |
| Invitations incomplete | Still open — §9 |
| `api_keys` unverifiable | Still flagged off — §9 |

---

## 3. New findings

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 1 | **HIGH** | `scans.status` writable by any member; whole state machine drivable by hand | L4 |
| 2 | **HIGH** | AI generation returned success when the credit charge failed | L1 |
| 3 | **HIGH** | Report creation left a live unpaid link when the charge failed | L1 |
| 4 | **HIGH** | Supabase default privileges re-grant EXECUTE on every new function to `anon` | L4 |
| 5 | **MEDIUM** | Report tokens stored in plaintext | L4 |
| 6 | **MEDIUM** | Google-derived Places content sent to OpenAI with no gate | L1 + terms review |
| 7 | **CRITICAL (operational)** | Deployed master cannot create or cancel scans against the current schema | L4 |

---

## 4. Findings fixed

### 4.1 Scan state machine (HIGH)

**Attack.** Any workspace member issues `PATCH /rest/v1/scans?id=eq.X` with
`{"status":"completed"}`. Proven live across `completed`, `queued`, `failed`, `cancelled` —
every one accepted.

**Root cause.** Pass 1 granted `UPDATE (name, status, cancelled_at, completed_at)`. Status was
never meant to be in that list. The database enforced none of
`lib/workflows/scan-state.ts`.

**Impact.** Mark a never-run scan `completed`; mark a running scan `failed` to reach the refund
path; re-present a finished scan as `queued`.

**Fix.** `GRANT UPDATE (name)` only. Cancellation moves to
`request_scan_cancellation(uuid)` — SECURITY DEFINER, re-checks membership, and keeps the
status predicate *inside* the UPDATE so concurrent cancels serialise instead of both writing.

**Regression test.** Each column asserted in its own statement; five separate status targets;
three timestamp columns; plus cancellation working, refusing another tenant's scan, and
refusing a terminal scan. **L4.**

### 4.2 and 4.3 Fail-open billing (HIGH ×2)

**Attack.** Cause any credit failure other than `InsufficientCreditsError` — a ledger outage,
a constraint violation, a dropped connection. Both paid operations returned success.

**Root cause.** `catch { if (err instanceof InsufficientCreditsError) throw; logger.warn(...) }`
— every other billing failure logged and stepped over, after we had already paid OpenAI.

**Fix.** AI generation now **reserves before** calling the provider: an unavailable ledger stops
the work rather than giving it away, a provider failure releases the hold under a fixed key so
a retry cannot refund twice, and a failed consume after a successful draft fails the request —
a stranded reservation is visible and reconcilable, an unbilled generation is not. Report
creation rolls back on *every* billing failure, not only insufficient balance.

**Residual risk.** If the release after a provider failure also fails, credits stay reserved.
Logged at error, recoverable, and strictly better than an unbilled operation. **L1/L2** — the
injection test is not written; see §12.

### 4.4 Default execute privileges (HIGH)

**Attack.** Call any newly added function with the anon key and no session.

**Root cause.** Supabase ships
`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated`.
Pass 1 revoked only `PUBLIC`, which does not touch a direct role grant.

**Fix.** Default privileges revoked from `anon` and `authenticated` as well, plus a `DO` block
that re-asserts every function in the schema against an explicit nine-entry allow-list.

**Verified.** `anon`-executable is now **empty**; `authenticated` holds exactly the nine
intended. **L4.**

### 4.5 Report token digest (MEDIUM)

`public_reports.token` held the bearer secret verbatim — a backup or leaked service-role key
carried every live report URL, and those URLs need no session. Now SHA-256 digest plus a
non-secret 12-character prefix; plaintext column dropped. Because `hashToken()` is exactly
`encode(sha256(token::bytea),'hex')`, existing rows backfilled to the value their own token
produces and **no live link broke**.

**Deliberate product consequence:** an existing report's URL can no longer be reconstructed, so
drafts cannot auto-attach one. That capability required holding a reversible secret.

**Regression test.** Asserts the plaintext column is gone from the live schema, that the full
serialised row contains the token nowhere, that the digest resolves and a wrong token does not,
and that the view counter is not session-callable. **L4.**

### 4.6 Google Places compliance gate (MEDIUM)

Terms were read this time.

**Verified fact.** Place ID is explicitly exempt from the caching restrictions and may be
stored indefinitely — the schema already relies on exactly this. Places results shown on a map
must be on a Google Map; the Maps JavaScript integration satisfies that. The Service Specific
Terms prohibit using Google Maps Content to "train, test, validate or fine-tune" ML models and
prohibit separating Maps Content from grounded output.

**Interpretation.** Inference is not training, and OpenAI states API data is not used for
training by default.

**Unresolved contractual question.** Whether passing Google Maps Content to a third-party LLM
is permitted under the Agreement at all. Not mine to settle.

**Fix — a technical gate, not an opinion.** `businessName`, `district`, `city`, `rating`,
`reviewCount` and `googleGaps` are stripped before the prompt is built unless an operator sets
`ai_provider_content`, which **defaults off**. Drafts keep everything this application produced
itself. The test asserts the *property* — no Google-derived string survives anywhere in the
serialised payload — rather than a field list, so code and report cannot drift.

Sources: [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies),
[Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)

---

## 5. Concurrency (§8) — newly covered

Never tested before. Four properties, executed concurrently against real Postgres:

| Property | Result |
|---|---|
| 20 parallel applications of one idempotency key | Exactly **1** ledger row, exactly 5 credits moved |
| 40 concurrent spends of 10 against a smaller balance | Balance never negative |
| Account balance vs sum of ledger rows | Equal |
| UPDATE/DELETE on ledger as service role | Rejected |

**L5.** The credit ledger is the strongest component in this system.

**Not covered:** the `remainingCapacity()` read-then-slice race across parallel discovery
workers, and `claimScanJob`'s read-then-update. Both remain **unverified** — §12.

---

## 6. Findings intentionally left open

| Item | Why | Needed before production |
|---|---|---|
| Invitations | Plaintext token and no acceptance flow exists. Feature work, not a patch | Build it or hide the creation UI |
| `api_keys` | No verification layer anywhere in `src` | Flag stays off |
| CSP | A wrong CSP breaks pages rather than warning | Report-only rollout first |
| `undici`/`nanoid` advisories | Only offered fix is a major `workflow` downgrade that breaks the scan engine | Track upstream |

---

## 7. Evidence level per finding

| Finding | Level | What proves it |
|---|---|---|
| Scan status bypass | **L4** | Live session drove four states; now blocked by test |
| Default execute privileges | **L4** | `has_function_privilege` before/after; anon surface empty |
| Report token digest | **L4** | Live schema + serialised-row assertions |
| Credit concurrency | **L5** | 20- and 40-way parallel execution |
| Billing fail-closed | **L1/L2** | Code path + full suite; **failure injection not written** |
| Google gate | **L2** | Unit test on the property; terms read at source |
| Deployment regression | **L4** | Deployed master's exact statements run live → `42501` |

---

## 8. Production deployment state — **read this first**

Pass 1's migration was applied to the production database while master's code was not
deployed. The two are now incompatible.

Running the exact statements deployed master issues, as a real session:

```
deployed master's post-start update -> FAILS: 42501 permission denied for table scans
deployed master's cancelScan update -> FAILS: 42501 permission denied for table scans
```

**Effect on production right now:**

- **Scan creation silently loses `workflow_run_id`.** That line has no error check, so the scan
  stays `created`, the run id is never stored, and cancel/retry can never find the run.
- **Cancelling a scan throws.**

This is a regression I introduced by applying a migration ahead of the code that depends on it.

**Deployment order — migrations are already applied, so the code must now catch up:**

1. Merge `security/remediation-2-2026-09-19` (it moves those writes to the service-role client
   and routes cancellation through the RPC).
2. Deploy.
3. Verify scan creation records a `workflow_run_id` and cancellation succeeds.

No further migration is needed; the database is ahead, not behind.

**Rollback:** reverting the code does not restore service — the grants are what changed. A true
rollback means re-granting the scan columns, which re-opens §4.1.

---

## 9. Tests executed

```
npx vitest run tests/security/tenancy.test.ts            40 passed
npx vitest run tests/security/credit-concurrency.test.ts  4 passed
npm run check                                            exit 0
  typecheck · lint · check:sql · check:i18n · 51 files / 629 tests · build
```

`check-sql` was also fixed: it read only the first clause of a multi-column `ALTER TABLE`, so a
real index was reported as referencing a nonexistent column.

---

## 10. Remaining risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Deployed master broken** | Scans cannot be created or cancelled | Deploy this branch |
| Discovery capacity race | `max_businesses` may be exceeded; over-billing | Atomic claim; untested |
| Billing failure injection untested | Fail-closed is argued from code, not proven | Write the injection test |
| Invitations / API keys incomplete | Credentials that grant nothing | Build or hide |
| SSRF, prompt injection, auth/CSRF, rate limiting, deletion flows | Unknown | Not examined in either pass |
| Google contractual question | Unresolved | Gate defaults off |

---

## 11. Final status

# NOT READY FOR PRODUCTION

Three of the brief's own disqualifiers are open:

- **Server-owned workflow state was tenant-writable** — fixed here, but undeployed.
- **Race condition capable of breaking credit integrity** — the discovery capacity race is
  unverified, so it cannot be ruled out.
- **Incomplete auth credential features exposed to users** — invitations still create tokens
  nothing can redeem.

And independently: **production is currently degraded**. That alone settles the gate.

The branch is review-ready and unmerged.
