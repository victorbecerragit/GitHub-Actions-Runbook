# Cloudflare Workers + D1 Migration Plan (Structure Only)

Date: 2026-05-27
Status: Planning only (no implementation in this step)
Scope: Incremental migration from Replit-hosted Node/Express + PostgreSQL to Cloudflare Workers + D1, while preserving existing frontend UI and API behavior.

## Goals

- Keep frontend UI and routes unchanged.
- Preserve existing CRUD behavior and API contract paths under /api.
- Replace backend runtime gradually with one Worker service.
- Replace PostgreSQL runtime dependency with D1 using Wrangler migrations.
- Keep secrets out of the repo.

## Non-Goals

- No UI rewrite.
- No large refactors unrelated to migration.
- No schema redesign beyond what is needed for D1 compatibility.

## Current Baseline

- Frontend: artifacts/runbook (React + Vite).
- Backend: artifacts/api-server (Express on Node).
- DB package: lib/db (Drizzle + pg/PostgreSQL dialect).
- API contract/codegen: lib/api-spec + lib/api-client-react + lib/api-zod.
- Replit-specific coupling exists in Vite config and root/project metadata.

## Migration Strategy (Incremental)

1. Introduce a new Cloudflare Worker backend package in parallel.
2. Port API routes to Worker handlers while preserving existing endpoint paths and payloads.
3. Add D1-backed Drizzle adapter and migrations in parallel with existing PostgreSQL setup.
4. Switch frontend runtime API target to Worker deployment origin (no route/UI changes).
5. Remove Replit-only runtime dependencies and old backend once parity is verified.

## Target Structure

- artifacts/worker-api/
  - package.json
  - tsconfig.json
  - wrangler.toml
  - src/
    - index.ts
    - routes/
      - health.ts
      - runbooks.ts
    - lib/
      - logger.ts
      - db.ts
  - migrations/
    - 0001_initial.sql

- lib/db/
  - Keep schema definitions reusable.
  - Add D1-compatible entrypoint(s) for Worker runtime.

## Files To Create

- artifacts/worker-api/package.json
- artifacts/worker-api/tsconfig.json
- artifacts/worker-api/wrangler.toml
- artifacts/worker-api/src/index.ts
- artifacts/worker-api/src/routes/health.ts
- artifacts/worker-api/src/routes/runbooks.ts
- artifacts/worker-api/src/lib/logger.ts
- artifacts/worker-api/src/lib/db.ts
- artifacts/worker-api/migrations/0001_initial.sql
- docs/plans/2026-05-27-cloudflare-worker-d1-migration.md (this file)

## Files To Update

- artifacts/runbook/vite.config.ts
  - Remove Replit-only plugin/env assumptions.
  - Keep build output and frontend behavior unchanged.
- artifacts/runbook/package.json
  - Remove Replit-only dev dependencies if no longer needed.
- lib/db/src/index.ts
  - Add or split runtime adapters so Worker can use D1.
- lib/db/drizzle.config.ts
  - Add/adjust D1 migration configuration as needed.
- README.md
  - Local run/deploy instructions for Worker + D1.

## Files To Delete (After Parity)

- artifacts/api-server/** (remove only after Worker parity confirmed in dev and preview/prod).
- .replit
- artifacts/runbook/.replit-artifact/**
- artifacts/mockup-sandbox/.replit-artifact/**

## API Compatibility Requirements

- Keep endpoint paths under /api unchanged.
- Keep request/response shapes aligned to OpenAPI contract.
- Keep status code behavior consistent for success and error paths.
- Keep pagination/filter semantics unchanged where applicable.

## Data Layer Requirements

- Reuse existing Drizzle schema definitions where possible.
- Translate PostgreSQL-specific SQL/types to D1-compatible SQL where needed.
- Use Wrangler-managed D1 migrations.
- Seed flow should remain available for local/dev parity.

## Rollout Phases

### Phase 1: Worker Skeleton + Health

- Add worker package and wrangler config.
- Implement /api/healthz in Worker.
- Verify local Worker start and route response.

Exit criteria:
- Worker starts locally.
- /api/healthz returns expected payload and status.

### Phase 2: D1 Integration + Base Schema

- Add D1 database binding in wrangler.toml.
- Add initial SQL migration(s) in migrations/.
- Wire Worker DB access through D1 adapter.

Exit criteria:
- Migration applies via Wrangler.
- Worker can run read/write smoke test against D1.

### Phase 3: Runbooks API Parity

- Port runbooks routes to Worker handlers.
- Keep all current route paths and response shapes.
- Validate against existing generated client usage.

Exit criteria:
- CRUD + list/detail + seed/stat endpoints behave identically.
- Frontend works against Worker backend without UI changes.

Implementation notes (current):
- Worker runbook routes are now implemented in [artifacts/worker-api/src/index.ts](artifacts/worker-api/src/index.ts) and backed by D1 through the existing RunbooksRepository.
- Implemented endpoints: GET /api/runbooks, GET /api/runbooks/:id, POST /api/runbooks, PUT /api/runbooks/:id, DELETE /api/runbooks/:id, GET /api/runbooks/stats, POST /api/runbooks/seed.
- Route behavior follows existing Express status codes and response shapes as closely as possible, with minimal safe validation at the Worker boundary.
- Seed and stats are implemented on top of repository reads/writes; Express API and frontend wiring remain unchanged at this stage.

### Phase 4: Frontend Runtime Cutover

- Remove Replit assumptions in frontend dev/build config.
- Point runtime/proxy to Worker origin for /api.

Exit criteria:
- Frontend local dev and build pass.
- End-to-end flows work against Worker + D1.

### Phase 5: Decommission Legacy Runtime

- Remove artifacts/api-server and remaining Replit files.
- Clean workspace/package references.
- Update docs and scripts.

Exit criteria:
- No runtime dependency on Node/Express API server.
- CI/build/deploy paths rely on Worker + D1 only.

## Risks and Mitigations

- Risk: Behavioral drift in API responses.
  - Mitigation: Route-by-route parity checklist and contract validation against OpenAPI.
- Risk: SQL incompatibilities moving from PostgreSQL to D1.
  - Mitigation: Incremental migrations and targeted query rewrites only where required.
- Risk: Hidden Replit assumptions in tooling.
  - Mitigation: Remove Replit plugins/env usage in small steps and verify each build/run stage.

## Verification Checklist

- [ ] Worker package boots locally.
- [ ] D1 database binding and migration apply successfully.
- [ ] /api/healthz parity confirmed.
- [ ] All runbooks endpoints parity confirmed.
- [ ] Frontend works with unchanged pages/routes.
- [ ] No Replit-only runtime dependencies remain.
- [ ] README includes local and deploy instructions.

## Local Test Plan (When Implementation Starts)

- Start Worker locally via Wrangler.
- Apply D1 migrations.
- Exercise API endpoints (health + runbooks CRUD).
- Run frontend against Worker API and verify key user journeys:
  - list runbooks
  - open detail
  - create
  - edit
  - delete

## Notes

- This document is intentionally structure-only and implementation-neutral.
- Implementation should proceed in small, reversible commits.

## Wrangler Notes and Commands

### Current Wrangler Setup Notes

- Worker package location: artifacts/worker-api
- Wrangler config file: artifacts/worker-api/wrangler.toml
- D1 binding name used by Worker runtime: DB
- D1 database logical name: runbook-d1
- Replace placeholder database_id in wrangler.toml before remote migration apply.

### D1 Migration Files

- Initial runbooks migration file:
  - artifacts/worker-api/migrations/0001_initial_runbooks.sql

### Create D1 Database

Run from repo root:

```bash
pnpm --filter @workspace/worker-api exec wrangler d1 create runbook-d1
```

After creation, copy the returned database_id into:

- artifacts/worker-api/wrangler.toml

### Apply Migrations (Local)

Run from repo root:

```bash
pnpm --filter @workspace/worker-api exec wrangler d1 migrations apply runbook-d1 --local
```

Alternative from worker package directory:

```bash
cd artifacts/worker-api
wrangler d1 migrations apply runbook-d1 --local
```

### Apply Migrations (Remote)

Run from repo root:

```bash
pnpm --filter @workspace/worker-api exec wrangler d1 migrations apply runbook-d1 --remote
```

Alternative from worker package directory:

```bash
cd artifacts/worker-api
wrangler d1 migrations apply runbook-d1 --remote
```

### Useful Verification Commands

Run from repo root:

```bash
pnpm dev:cf
curl http://localhost:8787/api/healthz
```
