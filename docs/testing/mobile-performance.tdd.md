# Mobile performance regression evidence

## Scope

This run covers the mobile latency and accessibility regressions found in the production audit:

- navigation requests must have a bounded service-worker network wait;
- login must avoid the extra `/` database redirect;
- independent server reads must run in parallel;
- history child records must be batched;
- exercise cards and history tabs must expose valid mobile semantics;
- route logs must label database time as `dbMs`.

## RED/GREEN evidence

The regression suite was first executed against the unmodified code and failed 8/8 assertions. After the focused implementation, it passed 9/9 assertions:

```text
npm test -- --run apps/web/tests/performance-regressions.test.ts
✓ 9 tests passed
```

Schema coverage was added for the new owner/history indexes and composite primary keys:

```text
npm test -- --run apps/web/tests/postgres-schema.test.ts
✓ 8 tests passed
```

## Verification matrix

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Service-worker navigation has a timeout and cached fallback | `apps/web/tests/performance-regressions.test.ts` | PASS |
| Login defaults to `/hoy` instead of `/` | `apps/web/tests/performance-regressions.test.ts` | PASS |
| `/plan`, `/historial` and `/ejercicios` parallelize independent reads | `apps/web/tests/performance-regressions.test.ts` | PASS |
| History metrics, sets and exposures are batch-loaded | `apps/web/tests/performance-regressions.test.ts` | PASS |
| Mobile touch target and tab relationships remain accessible | `apps/web/tests/performance-regressions.test.ts` | PASS |
| Supabase/Drizzle schema includes performance indexes and composite keys | `apps/web/tests/postgres-schema.test.ts` | PASS |
| Full unit/integration suite | `npm test` | 50 files / 279 tests PASS |
| Coverage | `npm run test:coverage` | 95.58% lines, 84.31% branches |
| Type safety | `npm run typecheck` | PASS |
| Production build | `npm run build` | PASS; one pre-existing Autoprefixer warning |
| Lint | `npm run lint` | PASS; informational missing `pages` directory notice |

## Follow-up

The migration `apps/web/drizzle/0002_bizarre_mandroid.sql` is ready to run through the normal deployment migration step. It has not been applied directly to the hosted Supabase project in this task.
