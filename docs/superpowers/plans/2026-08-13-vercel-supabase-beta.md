# Vercel + Supabase Closed Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Trainer as a closed, installable iPhone PWA on Vercel with durable Supabase Postgres and private file storage, at zero initial infrastructure cost.

**Architecture:** Vercel Hobby runs Next.js and its authenticated server routes. Supabase Free supplies Postgres for Better Auth and Trainer data, plus a private Storage bucket for activity files; browser uploads use short-lived signed URLs so 15 MB files never traverse a Vercel Function. The database remains server-only: browser clients never receive a database password or Supabase service-role key.

**Tech Stack:** Next.js 15, React 19, Better Auth, Drizzle ORM, `postgres`/`drizzle-orm/postgres-js`, Supabase Postgres and Storage, Vercel Hobby, Vitest, Playwright mobile verification.

## Global Constraints

- Pilot: no more than four participant accounts plus one operator account.
- Production sign-up stays disabled; there is no public account administration, password recovery, or password change.
- Keep Better Auth; do not replace it with Supabase Auth.
- Retain all existing `ownerId` isolation, idempotency, version-conflict and deletion semantics.
- Preserve the 15 MB FIT/TCX/GPX product limit; uploads must bypass Vercel Function request bodies.
- Keep application tables server-only; any exposed Supabase schema/table must have RLS and explicit ownership policies.
- Use no paid plan, card-funded overage, new cloud service, deployment, or external account mutation until the user explicitly authorizes that action.
- Vercel Hobby is personal/non-commercial only; Supabase Free may pause after a week without sufficient activity and has no automatic backups.
- Validate all changed UI flows in a narrow mobile viewport and in Safari on an iPhone before accepting the beta.

---

## File Structure

- Modify: `package.json` — replace SQLite-only runtime packages and scripts with Postgres-compatible equivalents.
- Modify: `apps/web/src/lib/db/client.ts` — lazy, server-only Postgres Drizzle client.
- Modify: `apps/web/src/lib/db/schema.ts` — PostgreSQL schema equivalent of every current SQLite table/index/foreign key.
- Replace: `apps/web/drizzle/*` — PostgreSQL migration baseline and migration runner.
- Modify: `apps/web/src/lib/auth.ts`, `apps/web/app/login/page.tsx` — production closed-registration configuration and copy.
- Create: `apps/web/src/lib/storage/supabase-server.ts` — server-only Supabase Storage adapter.
- Replace: `apps/web/src/features/endurance/domain/storage.ts` — object key, hashing and server-side Storage operations; no local filesystem calls.
- Modify: `apps/web/src/features/endurance/domain/import-repository.ts`, `apps/web/src/app/api/v1/activity-imports/handler.ts`, `apps/web/app/api/v1/activity-imports/route.ts` — signed upload lifecycle and confirmed import persistence.
- Create: `apps/web/app/api/v1/activity-imports/upload-url/route.ts` and handler — authenticated, validated signed-upload issuance.
- Modify: `apps/web/src/features/endurance/ui/ImportWizard.tsx` — direct browser upload and post-upload confirmation states.
- Modify: all domain repositories and API handlers that currently accept `better-sqlite3` handles — Postgres async transactions and return types.
- Modify: `apps/web/src/features/account/domain/account-deletion.ts` — delete owned private Storage objects before account deletion.
- Create: `apps/web/scripts/manage-user.ts` — local CLI for create and password reset through Better Auth.
- Create: `apps/web/scripts/backup-production.ts` and `apps/web/scripts/restore-production.md` — verified operator backup instructions/artifacts without embedding credentials.
- Create: `vercel.json`, `.vercelignore`, `docs/runbooks/beta-vercel-supabase.md`, `docs/runbooks/iphone-pwa-checklist.md` — deploy settings and operator runbooks.
- Modify/Create tests under `apps/web/tests/` — Postgres-safe repository fixtures, account lifecycle, storage authorization, signed upload and production registration tests.

## Task 1: Establish the serverless Postgres foundation

**Files:**
- Modify: `package.json`
- Modify: `apps/web/src/lib/db/client.ts`
- Modify: `apps/web/src/lib/db/schema.ts`
- Create: `apps/web/tests/postgres-schema.test.ts`

**Interfaces:**
- Produces: `getDb(): PostgresJsDatabase<typeof schema>` and `getSql(): Sql` for server code.
- Consumes: `DATABASE_URL` only at request/runtime, never through `NEXT_PUBLIC_*`.

- [ ] **Step 1: Write a failing schema test**

```ts
it("defines owner foreign keys and unique ownership indexes in Postgres", () => {
  expect(schema.trainingPlan.ownerId.notNull).toBe(true);
  expect(schema.trainingPlan.ownerId.name).toBe("owner_id");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- apps/web/tests/postgres-schema.test.ts`

Expected: FAIL because the Postgres schema/client does not exist.

- [ ] **Step 3: Replace SQLite primitives with Postgres primitives**

Use `pgTable`, `text`, `integer`, `real`, `boolean`, `timestamp`, `jsonb`, `uniqueIndex` and explicit foreign keys. Preserve every table, default, unique index and `onDelete` behavior in the current schema. Change IDs and JSON only where necessary for Postgres compatibility; do not change domain field names or ownership rules.

```ts
export const trainingPlan = pgTable("training_plan", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  contentJson: text("content_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("training_plan_owner_id_idx").on(table.ownerId, table.id)]);
```

- [ ] **Step 4: Add a lazy server-only database factory**

Use `postgres` with Supabase's pooled Postgres connection string and `drizzle-orm/postgres-js`. Throw a descriptive error only when a route actually needs an absent `DATABASE_URL`; do not connect at module evaluation during `next build`.

- [ ] **Step 5: Run focused tests and static checks**

Run: `npm test -- apps/web/tests/postgres-schema.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json apps/web/src/lib/db apps/web/tests/postgres-schema.test.ts
git commit -m "feat: add serverless postgres foundation"
```

## Task 2: Convert migrations and Better Auth without public sign-up

**Files:**
- Modify: `apps/web/drizzle.config.ts`
- Replace: `apps/web/drizzle/migrate.ts`
- Create: `apps/web/drizzle/0000_supabase_postgres.sql`
- Modify: `apps/web/drizzle/seed.ts`
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/app/login/page.tsx`
- Create: `apps/web/tests/auth-production.test.ts`

**Interfaces:**
- Consumes: `getDb()` from Task 1 and `BETTER_AUTH_URL`.
- Produces: `auth` backed by Postgres and a migration command that exits non-zero on failure.

- [ ] **Step 1: Write failing production-auth tests**

```ts
it("never renders a sign-up control in production", () => {
  expect(loginSource).not.toContain("Crear cuenta local");
});

it("creates Better Auth with public registration disabled", () => {
  expect(createAuth().options.emailAndPassword.disableSignUp).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- apps/web/tests/auth-production.test.ts`

Expected: FAIL because the current local-development account creation branch remains.

- [ ] **Step 3: Generate and review a Postgres migration baseline**

Generate SQL from the converted Drizzle schema, then inspect it for all Better Auth and Trainer tables, `ON DELETE CASCADE` constraints, unique indexes, and timestamp defaults. Configure migrations to use the Postgres connection only from an operator shell, never during Vercel build.

- [ ] **Step 4: Configure Better Auth and login UI**

Use the Drizzle adapter with provider `pg`, retain `emailAndPassword.enabled: true` and make `disableSignUp: true` unconditional outside tests that explicitly construct an opt-in test instance. Remove every production-visible sign-up label and error that suggests it is available.

- [ ] **Step 5: Run migration against a disposable Supabase development project and test**

Run: `npm run db:migrate && npm test -- apps/web/tests/auth-production.test.ts && npm run typecheck`

Expected: migration exits 0; tests PASS; no public sign-up control exists.

- [ ] **Step 6: Commit**

```bash
git add apps/web/drizzle apps/web/src/lib/auth.ts apps/web/app/login/page.tsx apps/web/tests/auth-production.test.ts
git commit -m "feat: migrate auth schema to postgres"
```

## Task 3: Port repositories and handlers to asynchronous Postgres transactions

**Files:**
- Modify: `apps/web/src/features/{planning,workouts,training-engine,recovery,endurance,history,catalog,onboarding}/**/*.ts`
- Modify: `apps/web/src/app/api/**/*.ts`
- Modify: `apps/web/app/api/**/*.ts`
- Modify: all tests importing `better-sqlite3`

**Interfaces:**
- Consumes: Task 1 `getDb()`/`getSql()`.
- Produces: repository factories accepting `Db` only and returning promises for all read/write operations.

- [ ] **Step 1: Write failing transaction and conflict tests**

Port the existing workout-finish, outbox-replay, plan-activation and account-isolation cases to a disposable Postgres fixture. Keep assertions for replay success, stale-version conflict, and cross-owner `404`/non-disclosure.

```ts
await expect(repository.finish(ownerId, input)).resolves.toMatchObject({ status: "completed" });
await expect(repository.finish(ownerId, conflictingInput)).rejects.toBeInstanceOf(VersionConflictError);
```

- [ ] **Step 2: Run the ported suites and verify failure**

Run: `npm test -- apps/web/tests/workout-session-repository.test.ts apps/web/tests/plan-activation.test.ts apps/web/tests/authorization.test.ts`

Expected: FAIL because repository signatures still use `Database.Database` and synchronous `.run()`/`.get()` calls.

- [ ] **Step 3: Port by domain boundary, not route-by-route**

For every repository, replace injected SQLite handles and `.transaction()` calls with `await db.transaction(async (tx) => ...)`; use transactional `tx` for every dependent read/write. Convert route handlers to `await` repositories. Preserve existing application error classes and HTTP response mappings.

- [ ] **Step 4: Remove SQLite-only imports and test fixtures**

Replace in-memory SQLite fixtures with a dedicated disposable Postgres schema/database configured only for tests. Reset fixtures between tests and never point a test URL at the production Supabase project.

- [ ] **Step 5: Run the full regression gate**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: all pass with zero `better-sqlite3`, `sqliteTable`, `sqliteHandle` or synchronous SQLite transaction imports in production code.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/app apps/web/tests
git commit -m "refactor: port trainer repositories to postgres"
```

## Task 4: Move private activity files to Supabase Storage

**Files:**
- Create: `apps/web/src/lib/storage/supabase-server.ts`
- Replace: `apps/web/src/features/endurance/domain/storage.ts`
- Modify: `apps/web/src/features/endurance/domain/import-repository.ts`
- Modify: `apps/web/src/features/account/domain/account-deletion.ts`
- Create: `apps/web/tests/private-storage.test.ts`

**Interfaces:**
- Produces: `createPrivateUploadKey(ownerId, format)`, `createSignedUpload(key, contentType)`, `readPrivateUpload(key)`, `deletePrivateUpload(key)` and `deleteOwnedUploads(keys)`.
- Consumes: server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no `NEXT_PUBLIC_` secret.

- [ ] **Step 1: Write failing Storage authorization tests**

```ts
it("uses an owner-scoped unguessable key and deletes only the requested object", async () => {
  const key = createPrivateUploadKey("account-a", "fit");
  expect(key).toMatch(/^activity-imports\/account-a\/[0-9a-f-]+\.fit$/);
  await storage.deletePrivateUpload(key);
  expect(storage.remove).toHaveBeenCalledWith([key]);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- apps/web/tests/private-storage.test.ts`

Expected: FAIL because storage writes to `process.cwd()` using `node:fs`.

- [ ] **Step 3: Implement private bucket adapter**

Create the `trainer-private` bucket manually in Supabase as private, with a 15 MB maximum and only FIT/TCX/GPX MIME types permitted. Use service-role credentials only in server modules to issue a single-object signed upload URL and to read/delete after ownership is verified by Trainer. Keep the object key in `import_file.storage_key`; do not make raw objects public.

- [ ] **Step 4: Preserve deletion semantics**

Make `deleteOwnAccount` list its remaining owned import rows, delete their objects first, delete Better Auth sessions, then delete the user inside the database lifecycle. An already-missing object must not prevent account deletion.

- [ ] **Step 5: Run tests**

Run: `npm test -- apps/web/tests/private-storage.test.ts apps/web/tests/account-deletion.test.ts`

Expected: PASS; no `node:fs` reference remains in production upload storage.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storage apps/web/src/features/endurance apps/web/src/features/account apps/web/tests
git commit -m "feat: store private imports in supabase"
```

## Task 5: Implement direct, authenticated uploads up to 15 MB

**Files:**
- Create: `apps/web/src/app/api/v1/activity-imports/upload-url/handler.ts`
- Create: `apps/web/app/api/v1/activity-imports/upload-url/route.ts`
- Modify: `apps/web/src/app/api/v1/activity-imports/handler.ts`
- Modify: `apps/web/app/api/v1/activity-imports/route.ts`
- Modify: `apps/web/src/features/endurance/ui/ImportWizard.tsx`
- Create: `apps/web/tests/activity-upload-url.test.ts`
- Modify: `apps/web/tests/activity-imports-handler.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/activity-imports/upload-url` accepting `{ name, sizeBytes, mimeType }` and returning `{ storageKey, token, path }` only for an authenticated user.
- Consumes: Task 4 signed Storage adapter.

- [ ] **Step 1: Write failing endpoint tests**

```ts
it("rejects unauthenticated, unsupported and over-15-MB upload requests", async () => {
  await expect(issueUploadUrl(null, validInput)).resolves.toMatchObject({ status: 401 });
  await expect(issueUploadUrl(user, { ...validInput, sizeBytes: 15 * 1024 * 1024 + 1 })).resolves.toMatchObject({ status: 413 });
});

it("returns a signed URL only for a validated owner-scoped object key", async () => {
  await expect(issueUploadUrl(user, validInput)).resolves.toMatchObject({ status: 200 });
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- apps/web/tests/activity-upload-url.test.ts`

Expected: FAIL because no signed-upload endpoint exists.

- [ ] **Step 3: Issue and consume signed upload URLs**

Validate filename extension, MIME type and 15 MB size before issuing. In the browser, calculate SHA-256 while reading the selected file, call the signed-upload endpoint, upload directly with `uploadToSignedUrl`, then call the existing authenticated confirm endpoint with the issued `storageKey`, original metadata and hash. Reject a confirmation whose key is not owned by the current user or whose object metadata disagrees.

- [ ] **Step 4: Keep UI states mobile-safe**

Add compact progress, retry and error states to ImportWizard. Do not claim a completed import until the confirmation endpoint has returned success. Preserve the existing parser, duplicate detection and commit sequence.

- [ ] **Step 5: Validate Vercel-size compliance**

Run: `npm test -- apps/web/tests/activity-upload-url.test.ts apps/web/tests/activity-imports-handler.test.ts && npm run build`

Expected: a 15 MB test upload has no request body sent to a Vercel API route; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api apps/web/app/api apps/web/src/features/endurance/ui apps/web/tests
git commit -m "feat: upload activity files directly to storage"
```

## Task 6: Add the operator-only account CLI and production guardrails

**Files:**
- Create: `apps/web/scripts/manage-user.ts`
- Modify: `package.json`
- Create: `apps/web/tests/manage-user.test.ts`
- Modify: `apps/web/src/lib/auth.ts`

**Interfaces:**
- Produces: `npm run user:create -- --name "…" --email "…" --password "…"` and `npm run user:reset-password -- --email "…" --password "…"`.
- Consumes: local `DATABASE_URL` and `BETTER_AUTH_URL`; the CLI never runs in Vercel.

- [ ] **Step 1: Write failing CLI tests**

```ts
it("creates an account through Better Auth and never logs its password", async () => {
  const output = await runCli(["user:create", "--name", "Ana", "--email", "ana@example.test", "--password", "temporary-123"]);
  expect(output).toContain("Cuenta creada para ana@example.test");
  expect(output).not.toContain("temporary-123");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- apps/web/tests/manage-user.test.ts`

Expected: FAIL because no CLI exists.

- [ ] **Step 3: Implement explicit, non-interactive commands**

Parse only `--name`, `--email` and `--password`; validate non-empty name, normalized valid email and password length of at least eight. Create via `auth.api.signUpEmail` in a CLI-specific instance that permits server-side provisioning; reset through Better Auth's documented server API. Print no credentials, connection strings, hashes or stack traces containing input.

- [ ] **Step 4: Enforce the five-account ceiling**

Before creating a pilot account, count active accounts and reject when the configured `PILOT_ACCOUNT_LIMIT=5` would be exceeded. Reset must not change the count.

- [ ] **Step 5: Run test and typecheck**

Run: `npm test -- apps/web/tests/manage-user.test.ts apps/web/tests/auth-production.test.ts && npm run typecheck`

Expected: PASS; client registration remains disabled.

- [ ] **Step 6: Commit**

```bash
git add package.json apps/web/scripts apps/web/src/lib/auth.ts apps/web/tests/manage-user.test.ts
git commit -m "feat: add closed-beta account management cli"
```

## Task 7: Create backup, restore and release runbooks

**Files:**
- Create: `apps/web/scripts/backup-production.ts`
- Create: `docs/runbooks/beta-vercel-supabase.md`
- Create: `docs/runbooks/iphone-pwa-checklist.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: timestamped local backup directory with a Postgres dump checksum and a Storage object manifest/checksum list.
- Consumes: operator-only environment variables and a destination outside the repository.

- [ ] **Step 1: Write a failing backup-manifest test**

```ts
it("writes a manifest with schema version, UTC timestamp and checksums without secrets", async () => {
  const manifest = await createBackupManifest(fixture);
  expect(manifest.postgres.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(manifest)).not.toContain("postgres://");
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- apps/web/tests/backup-production.test.ts`

Expected: FAIL because no backup manifest script exists.

- [ ] **Step 3: Implement backup artifact creation**

Use a local operator command to run `pg_dump` against Supabase Postgres, list/download all objects from `trainer-private`, compute SHA-256 checksums and write `manifest.json`. Ignore the configured backup directory in Git. Do not automate backups from Vercel or place database credentials in a deployment artifact.

- [ ] **Step 4: Document restore and manual release decisions**

Document exact preflight variables, migration command, preview verification, backup, production promotion, rollback and restore order. State that a failing migration must stop promotion and that restoring a database requires restoring the matching Storage snapshot when import metadata is involved.

- [ ] **Step 5: Run test**

Run: `npm test -- apps/web/tests/backup-production.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .gitignore apps/web/scripts docs/runbooks apps/web/tests/backup-production.test.ts
git commit -m "docs: add beta backup and release runbooks"
```

## Task 8: Provision and configure free services manually

**Files:**
- Create: `vercel.json`
- Create: `.vercelignore`
- Modify: `docs/runbooks/beta-vercel-supabase.md`

**Interfaces:**
- Produces: one Vercel Hobby project and one Supabase Free project connected only through encrypted Vercel environment variables.

- [ ] **Step 1: Obtain explicit authorization before external creation**

Do not create accounts, install Marketplace integrations, deploy, upload production data, add a card, or alter DNS until the user approves this task's checklist and authorizes the specific external actions.

- [ ] **Step 2: Create Supabase resources through the dashboard**

Create one EU-region Free project, record its project reference privately, create the private `trainer-private` bucket with 15 MB limit and allowed FIT/TCX/GPX content types, and create a server-only database role/pooled connection. Do not enable anonymous table access. If Storage policies are needed, make them deny-by-default and allow only signed server-controlled operations.

- [ ] **Step 3: Apply baseline migration and verify it**

From a local shell with the production `DATABASE_URL` loaded only for the command, run the migration. Query `information_schema.tables` and the Drizzle migration ledger to confirm every required table appears once and no test data exists.

- [ ] **Step 4: Configure Vercel manually**

Import the Git repository, select `apps/web` as the project root or configure the monorepo build command, set Node version compatible with the locked dependencies, and add encrypted production-only environment variables: `DATABASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PILOT_ACCOUNT_LIMIT=5`.

- [ ] **Step 5: Keep releases manual**

Disable automatic production promotion. Allow Preview deployments for candidate branches; promote only a verified Preview artifact. Configure no custom domain until separately authorized; use the provided HTTPS Vercel URL for the pilot.

- [ ] **Step 6: Verify configuration without exposing secrets**

Run: `vercel build --prod` locally after pulling non-secret environment configuration, then inspect the Preview build log and call `/login`.

Expected: build succeeds; no secret appears in output; the app has HTTPS and sign-up is absent.

- [ ] **Step 7: Commit infrastructure-as-code documentation only**

```bash
git add vercel.json .vercelignore docs/runbooks/beta-vercel-supabase.md
git commit -m "chore: document closed beta deployment configuration"
```

## Task 9: Seed pilot accounts and execute release acceptance

**Files:**
- Modify: `docs/runbooks/beta-vercel-supabase.md`
- Modify: `docs/runbooks/iphone-pwa-checklist.md`

**Interfaces:**
- Consumes: live Preview/production URL, Task 6 CLI and Task 7 backup command.
- Produces: an acceptance record for the release commit and a maximum of five provisioned accounts.

- [ ] **Step 1: Create a pre-release backup**

Run the backup command and verify the manifest checksums before applying migrations or promoting a deployment.

- [ ] **Step 2: Validate the Preview flow**

Use a test account to verify: login succeeds; an unknown email cannot register; onboarding creates a plan; a workout starts, records a set and finishes; an owner cannot access another owner's URL/API resource; a 15 MB-valid import uses direct upload and can be deleted; account deletion removes its Storage object.

- [ ] **Step 3: Verify on the target iPhone**

Open the Preview in Safari, select “Compartir → Añadir a pantalla de inicio”, launch it standalone, sign in, record a set, go offline after a successful page load, recover network and confirm queued changes sync. Check keyboard focus, sticky controls and long workout scrolling at the device's native narrow viewport.

- [ ] **Step 4: Promote the exact verified artifact**

Run: `vercel promote <verified-preview-url>`

Expected: production alias points at that Preview without a different rebuild.

- [ ] **Step 5: Smoke test production and provision pilots**

Repeat login and set-recording smoke tests on production. Run `user:create` once for the operator and at most four times for pilots; record only email and creation time in the operator's secure ledger, never passwords.

- [ ] **Step 6: Verify update behavior and rollback**

Deploy a harmless Preview revision, promote it, then reopen/reload the installed iPhone PWA to confirm it receives the new shell. Use `vercel rollback <previous-deployment>` in Preview only to demonstrate rollback; do not run it in production unless a release has failed.

- [ ] **Step 7: Commit acceptance evidence**

```bash
git add docs/runbooks
git commit -m "docs: record closed beta acceptance checklist"
```

## Plan Self-Review

- Spec coverage: Tasks 1–3 migrate SQLite/Better Auth/data semantics; Tasks 4–5 cover private files and Vercel's 4.5 MB limit; Task 6 covers manual users and disabled registration; Task 7 covers required manual backups; Task 8 provisions Vercel/Supabase only after approval; Task 9 verifies iPhone installation, updates and rollback.
- Placeholder scan: no deferred technical decisions remain; external resource creation is intentionally authorization-gated.
- Interface consistency: `getDb()` is produced before repositories consume it; Storage adapter precedes signed-upload endpoint; CLI and backup tooling precede provisioning/acceptance.
