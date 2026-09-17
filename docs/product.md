# OpportunityOS — Product

## Who it is for

Freelancers and small digital agencies (web developers, SEO specialists, social media
managers, brand designers) who sell services to local businesses and want a repeatable way to
find prospects with *observable* gaps that match what they sell.

## Primary loop

Discover, Audit, Opportunity, Outreach, Pipeline.

1. **New Scan wizard**: choose an area (place search, centre + radius or drawn polygon),
   categories, services, audit depth, optional filters; review the credit estimate; start.
2. **Scan progress**: the scan runs asynchronously; the UI shows lifecycle stage and counts
   (targets, discovered, audited, scored, failed, remaining) in near real time.
3. **Opportunities**: a table of businesses ranked by *service-specific* opportunity scores
   with explicit evidence, digital-gap badges, website / Instagram / Google statuses, pipeline
   state and last contact.
4. **Business detail**: full profile with Google Business audit, website audit, Instagram
   status, per-service scores with reasons, optional competitor benchmark, recommended
   service packages, outreach drafts, pipeline and activity timeline.
5. **Write Message**: OpenAI-drafted, fact-bound outreach for WhatsApp, e-mail or
   Instagram DM. The user edits, copies and opens the channel manually. Nothing is auto-sent.
6. **Pipeline**: New, Contacted, Replied, Meeting, Proposal, Won, Lost with notes,
   follow-ups and an activity timeline.

## Differentiator: service-specific scoring

A business is not "has website / has no website". It has independent scores for each
service the workspace sells (Website Development, SEO, Social Media Management, Google
Business Optimization, Review Management, Branding & Logo). Each score is the normalised sum
of matched *rules* over *signals* and is shown with its reasons and a confidence level. The
highest is the **primary opportunity**; others above a threshold are **secondary**.

## Data-quality principles

* Every signal has `type`, `source`, `value`, `confidence`, `detected_at`, `explanation`.
* Statuses are explicit: `found`, `not_found`, `not_checked`, `unavailable`, `error`,
  `ambiguous`. `not_checked` is never displayed as `not_found`.
* Evidence types are explicit: `observed`, `derived`, `heuristic`, `unavailable`.
* No predictive "close probability". No unsupported claims. Neutral wording:
  "No website URL was found on the business profile" rather than "This business has no
  website".
* Provider results are not an exhaustive census; the UI says so.

## Credits

Scans and AI generation consume credits according to configurable pricing rules
(`credit_pricing_rules`). The wizard shows the estimate and remaining balance before start.
Credits are reserved on start, consumed per completed business and unused reservation is
refunded when the scan finishes, fails or is cancelled.

## Demo mode

When provider credentials are missing (or `DEMO_MODE=true`), Google Places, OpenAI and
PageSpeed are replaced with deterministic demo providers using fictional businesses. A
persistent "Demo data" indicator is shown. Supabase is required (the local stack works
offline).

## Compliance guardrails

* Google Places content is displayed with required attribution and is cached only within
  policy; only `place_id` is stored indefinitely (see `docs/provider-policy.md`).
* No mass or automated cold outreach. Messages are prepared; the user sends manually.
* Terms, Privacy, cookie consent, AI disclosure, workspace and account deletion and public
  report revocation are built in.

## Out of scope for the MVP

Automated follow-up sending, real payment processing (mock billing provider only),
browser-automation website audits, authenticated Instagram scraping, purchase prediction.
