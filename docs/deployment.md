# Deployment

## Vercel

The app is a standard Next.js project; `next build` succeeds from a clean clone
with no environment file at all (verified). If a deployment fails, the cause is
almost always project configuration rather than code.

Checklist, in the order worth checking:

1. **System Environment Variables must be enabled** in Project Settings →
   Environment Variables. The Workflow runtime detects Vercel through
   `VERCEL_DEPLOYMENT_ID`. Without it, workflows fall back to the filesystem-based
   Local World and fail against Vercel's read-only filesystem. This is the one
   requirement unique to this project.
2. **Production branch** — this repository's default branch is `master`. Vercel
   defaults to `main`. If they disagree, pushes produce no production deployment.
3. **Node version** — `package.json` sets `engines.node` to `>=20.9.0`. Next 16
   requires at least 20.9.
4. **Environment variables** — the build does not need any, but the running app
   does. At minimum set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
   `NEXT_PUBLIC_APP_URL`. Everything else falls back to demo providers.
5. **Root directory** — must be the repository root, not a subdirectory.

## Database

Migrations are not applied automatically. Point the Supabase CLI at the hosted
project and push them, or paste each file in `supabase/migrations` followed by
`supabase/seed.sql` into the SQL editor, in filename order.

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## First administrator

Once the database is migrated and `SUPABASE_SERVICE_ROLE_KEY` is available:

```bash
npm run admin:create -- --email you@example.com --workspace "Your Agency"
```

This creates the account, grants platform admin, creates the workspace and marks
its credit account unlimited, so scans and AI drafts are recorded but never
billed. It is idempotent and prints the generated password once.
