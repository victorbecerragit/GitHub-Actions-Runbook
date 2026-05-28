# GitHub Actions Runbook

[![Worker Deploy](https://github.com/victorbecerragit/GitHub-Actions-Runbook/actions/workflows/deploy-worker.yml/badge.svg?branch=main)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/actions/workflows/deploy-worker.yml)
[![Frontend Deploy](https://github.com/victorbecerragit/GitHub-Actions-Runbook/actions/workflows/deploy-frontend-pages.yml/badge.svg?branch=main)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/actions/workflows/deploy-frontend-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/victorbecerragit/GitHub-Actions-Runbook)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/victorbecerragit/GitHub-Actions-Runbook)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/victorbecerragit/GitHub-Actions-Runbook/pulls)

A full-stack internal tool for storing and retrieving operational runbooks for CI/CD pipelines. Built for DevOps and SRE teams who need fast, searchable access to step-by-step incident procedures.

> **Scaffolding note:** The initial project structure was generated using Replit's agent scaffolding (monorepo layout, OpenAPI codegen pipeline, shadcn/ui component library). All application logic, data model design, API route implementation, seed data, bug fixes, and manual verification were performed and validated by the developer. The severity-dropdown regression in the edit form was identified and fixed during manual QA.

---

## What it does

During incidents, engineers need to find the right runbook fast. This tool provides:

- A searchable, filterable index of operational runbooks (title, system, severity, tags)
- Full CRUD for runbook content: execution steps, rollback procedures, tags, severity level
- A copy-to-clipboard button on steps for quick paste into a terminal
- A seeded dataset of 5 real-world runbooks covering GitHub Actions, EKS, and Terraform failures
- A stats panel showing total count and critical-severity breakdown

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Routing | Wouter |
| Data fetching | TanStack Query v5 |
| Forms | react-hook-form + Zod |
| UI components | shadcn/ui (Radix UI primitives + Tailwind CSS) |
| Backend | Cloudflare Workers (primary), Express 5 (legacy) |
| ORM | Drizzle ORM |
| Database | Cloudflare D1 (primary), PostgreSQL (legacy) |
| Validation | Zod (shared schemas generated from OpenAPI spec) |
| API contract | OpenAPI 3.1 spec → Orval codegen (hooks + Zod schemas) |
| Monorepo | pnpm workspaces |

---

## Architecture

This project uses a **contract-first API design**: the OpenAPI spec is the single source of truth, and both the backend Zod validators and the frontend TanStack Query hooks are generated from it.

```
┌─────────────────────────────────────────────────────────────┐
│                        pnpm workspace                        │
│                                                             │
│  lib/api-spec/openapi.yaml   ←── single source of truth    │
│          │                                                  │
│          ▼  (orval codegen)                                 │
│  lib/api-client-react/       ←── TanStack Query hooks       │
│  lib/api-zod/                ←── Zod request/response schemas│
│  lib/db/                     ←── Drizzle ORM schema + client │
│                                                             │
│  artifacts/api-server/       ←── Express 5 REST API         │
│    └─ routes/runbooks.ts          uses api-zod for validation│
│                                                             │
│  artifacts/runbook/          ←── React + Vite SPA           │
│    └─ pages/                      uses api-client-react hooks│
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **OpenAPI-first:** changing the spec and re-running `pnpm --filter @workspace/api-spec run codegen` regenerates all hooks and validators in one step. The frontend and backend stay in sync without manual type duplication.
- **Tags stored as JSON string:** PostgreSQL `text` column with JSON serialization. Keeps the schema simple without requiring an array column or a join table for this internal tool's scale.
- **Filtering done in application layer:** search, severity, system, and tag filters run in JavaScript after a full table fetch. Acceptable for internal tooling; the query layer already supports indexed SQL filtering as a future upgrade path.
- **Edit form loader pattern:** the edit form waits for the runbook to load before mounting `useForm`, passing fetched data as `defaultValues`. This avoids a timing bug where Radix UI Select reads its initial state before `form.reset()` fires.

---

## Repository layout

```
lib/
  api-spec/openapi.yaml        — OpenAPI contract (edit this, not the generated files)
  api-client-react/            — Generated TanStack Query hooks (do not edit)
  api-zod/                     — Generated Zod schemas (do not edit)
  db/src/schema/runbooks.ts    — Drizzle table definition

artifacts/
  api-server/src/
    routes/runbooks.ts         — All 7 runbook REST endpoints
    routes/health.ts           — Health check
    app.ts                     — Express app setup
  runbook/src/
    pages/runbook-list.tsx     — List view with search, filter, stats
    pages/runbook-detail.tsx   — Detail view with copy-to-clipboard
    pages/runbook-form.tsx     — Create / edit form
    components/layout.tsx      — Shared header + nav wrapper
```

---

## Deployment flow

The frontend is built and deployed to GitHub Pages, while the API and database run on Cloudflare Workers + D1. The frontend reads the live API through `VITE_API_BASE_URL`, and the Worker uses CORS to allow the GitHub Pages origin to fetch data safely.

This setup keeps the demo public for reads, while write routes remain protected with `ADMIN_API_TOKEN`.

---

## CORS and GitHub Pages

The frontend runs on GitHub Pages and the API runs on Cloudflare Workers, so the browser treats them as different origins. The Worker allows requests from `https://victorbecerragit.github.io` and sends the CORS headers needed for the browser to read API responses.

This is why the demo can read runbooks from the Worker, while write routes still require `ADMIN_API_TOKEN`. `curl` works independently of CORS because browser restrictions do not apply there.

---

## Cloudflare Worker + D1 (Primary Setup and Deployment)

Prerequisites: Node.js 24, pnpm 9+, Cloudflare account, Wrangler authenticated.

```bash
# 1) Install dependencies
pnpm install

# 2) Create the remote D1 database
pnpm --filter @workspace/worker-api exec wrangler d1 create runbook-d1
```

After create, copy the returned database id.

```bash
# 3) Update wrangler.toml with the real database id
sed -i 's/database_id = "REPLACE_WITH_D1_DATABASE_ID"/database_id = "YOUR_DATABASE_ID"/' artifacts/worker-api/wrangler.toml
```

```bash
# 4) Apply remote migrations
pnpm --filter @workspace/worker-api exec wrangler d1 migrations apply runbook-d1 --remote

# 5) Set demo admin write token secret
pnpm --filter @workspace/worker-api exec wrangler secret put ADMIN_API_TOKEN

# 6) Deploy the Worker
pnpm --filter @workspace/worker-api run deploy
```

Use the deployed worker URL from deploy output (example: https://runbook-worker-api.<your-subdomain>.workers.dev).

```bash
# 7) Run frontend against deployed Worker
VITE_API_BASE_URL="https://runbook-worker-api.<your-subdomain>.workers.dev" \
pnpm --filter @workspace/runbook run dev
```

Optional (local Worker path):

```bash
pnpm --filter @workspace/worker-api run dev -- --port 8787 --local
pnpm --filter @workspace/runbook run dev
```

---

## Legacy Express + PostgreSQL (Secondary Path)

Use this only if you need the legacy backend during migration.

```bash
# 1) Set PostgreSQL connection
export DATABASE_URL="postgresql://user:password@localhost:5432/runbook"

# 2) Push schema
pnpm --filter @workspace/db run push

# 3) Start Express API
pnpm --filter @workspace/api-server run dev

# 4) Start frontend
pnpm --filter @workspace/runbook run dev
```

---

## Post-Deploy Verification Checklist (Worker)

```bash
WORKER_URL="https://runbook-worker-api.<your-subdomain>.workers.dev"
ADMIN_TOKEN="your-admin-token"

# Health
curl -sS "$WORKER_URL/api/healthz"

# Create
curl -sS -X POST "$WORKER_URL/api/runbooks" \
  -H 'Content-Type: application/json' \
  -H "x-admin-token: $ADMIN_TOKEN" \
  --data '{"title":"Deploy verify","system":"Cloudflare Workers","severity":"low","steps":"1. verify create","rollback":"1. delete record","tags":["verify","deploy"]}'

# Search
curl -sS "$WORKER_URL/api/runbooks?search=verify"

# Stats
curl -sS "$WORKER_URL/api/runbooks/stats"

# Unauthorized write (expected: 401)
curl -i -sS -X POST "$WORKER_URL/api/runbooks" \
  -H 'Content-Type: application/json' \
  --data '{"title":"Unauthorized demo write","system":"Cloudflare Workers","severity":"low","steps":"n/a","rollback":"n/a","tags":[]}'

# Authorized write (expected: 201)
curl -i -sS -X POST "$WORKER_URL/api/runbooks" \
  -H 'Content-Type: application/json' \
  -H "x-admin-token: $ADMIN_TOKEN" \
  --data '{"title":"Authorized demo write","system":"Cloudflare Workers","severity":"low","steps":"n/a","rollback":"n/a","tags":["demo"]}'
```

UI verification (frontend running with VITE_API_BASE_URL):

1. Create runbook from New Runbook page and confirm detail page opens.
2. Edit runbook fields and confirm updated values render on detail and list.
3. Delete runbook and confirm it disappears from the list.
4. Search by title or tag and confirm filtered results.
5. Confirm stats panel updates after create/edit/delete.

More migration details and local/remote notes: [docs/plans/2026-05-27-cloudflare-worker-d1-migration.md](docs/plans/2026-05-27-cloudflare-worker-d1-migration.md)

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/runbooks` | List all; supports `?search=`, `?severity=`, `?system=`, `?tag=` |
| `POST` | `/api/runbooks` | Create a runbook |
| `GET` | `/api/runbooks/stats` | Total count + breakdown by severity and system |
| `POST` | `/api/runbooks/seed` | Insert 5 example runbooks (no-op if data exists) |
| `GET` | `/api/runbooks/:id` | Fetch a single runbook |
| `PUT` | `/api/runbooks/:id` | Update a runbook |
| `DELETE` | `/api/runbooks/:id` | Delete a runbook (returns 204) |

---

## Data model

```sql
CREATE TABLE runbooks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  system      TEXT NOT NULL,        -- e.g. "GitHub Actions", "EKS", "Terraform"
  severity    TEXT NOT NULL,        -- "low" | "medium" | "high" | "critical"
  steps       TEXT NOT NULL,        -- plain text / markdown, multi-line
  rollback    TEXT NOT NULL,        -- rollback procedure, plain text / markdown
  tags        TEXT NOT NULL,        -- JSON array serialized as string, e.g. '["ci","eks"]'
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

---

## Manual verification performed

The following flows were verified end-to-end against the running application:

| Flow | Method | Result |
|---|---|---|
| List all runbooks | `GET /api/runbooks` | 5 seeded runbooks returned |
| Full-text search | `GET /api/runbooks?search=terraform` | 1 matching result |
| Severity filter | `GET /api/runbooks?severity=critical` | 1 result |
| Stats endpoint | `GET /api/runbooks/stats` | Correct totals and breakdown |
| Create runbook | `POST /api/runbooks` + UI form | 201 returned, tags stored as array |
| Update runbook | `PUT /api/runbooks/:id` + UI edit form | Fields updated, `updated_at` refreshed |
| Delete runbook | `DELETE /api/runbooks/:id` + UI dialog | 204 returned, subsequent GET returns 404 |
| Seed idempotency | `POST /api/runbooks/seed` (with data present) | Returns `{inserted: 0}`, no duplicates |
| Data persistence | API server restart | All rows survive (PostgreSQL-backed) |
| Edit form severity | Navigate to `/runbooks/:id/edit` | Correct severity pre-selected on load |
| Copy to clipboard | Click "Copy" on detail page | Steps copied, button shows "Copied" for 1.5s |
| TypeScript typecheck | `pnpm run typecheck` | Zero errors across all packages |

---

## Future improvements

- **SQL-layer filtering:** move search and filter logic from JavaScript into parameterized SQL queries (`ILIKE`, `ANY(tags_array)`) for correctness at scale
- **Tag normalization:** store tags in a separate `runbook_tags` join table to enable proper tag-based indexing and autocomplete
- **Markdown rendering:** render the `steps` and `rollback` fields as formatted HTML (e.g. with `react-markdown`) instead of raw `<pre>` blocks
- **Authentication:** add Replit Auth or Clerk to restrict access to internal users
- **Audit log:** track who created or last modified a runbook and when
- **Pagination:** add cursor-based pagination to the list endpoint for large runbook libraries
- **System filter UI:** the backend already supports `?system=` filtering; a system dropdown on the list page would expose it
- **Export:** allow exporting a runbook as a PDF or Markdown file for offline incident use
