# GitHub Actions Runbook

An internal tool for storing and looking up operational runbooks for CI/CD pipelines. Built for DevOps and SRE teams who need fast access to step-by-step procedures during incidents.

## Running locally

**Requirements:** Node.js 24, pnpm, a Postgres database (set `DATABASE_URL`)

```bash
# Install dependencies
pnpm install

# Push the database schema (first time only, or after schema changes)
pnpm --filter @workspace/db run push

# Start the API server (port 5000, proxied at /api)
pnpm --filter @workspace/api-server run dev

# Start the frontend (proxied at /)
pnpm --filter @workspace/runbook run dev

# Seed 5 example runbooks (safe to call repeatedly — no-ops if data exists)
curl -X POST http://localhost:80/api/runbooks/seed
```

**Full typecheck:**
```bash
pnpm run typecheck
```

## Features

- **List view** — all runbooks in a scannable table with severity badges, system label, and tags
- **Search** — live full-text search across title, system, steps, and rollback text
- **Severity filter** — filter by low / medium / high / critical
- **Stats panel** — shows total runbook count and critical count on the list page
- **Create** — form with title, system, severity, tags (comma-separated), execution steps, rollback procedure
- **Edit** — pre-populated form, updates in place
- **Delete** — confirmation dialog before permanent removal
- **Seed** — one-click seeding of 5 example runbooks (GitHub Actions, EKS, Terraform) when the database is empty

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/runbooks` | List all; supports `?search=`, `?severity=`, `?system=`, `?tag=` |
| POST | `/api/runbooks` | Create a runbook |
| GET | `/api/runbooks/stats` | Total count + breakdown by severity and system |
| POST | `/api/runbooks/seed` | Seed 5 example runbooks (idempotent) |
| GET | `/api/runbooks/:id` | Get a single runbook |
| PUT | `/api/runbooks/:id` | Update a runbook |
| DELETE | `/api/runbooks/:id` | Delete a runbook |
| GET | `/api/healthz` | Health check |

## Stack

- **Frontend:** React 18, Vite, Wouter (routing), TanStack Query, react-hook-form, Zod, shadcn/ui components
- **Backend:** Express 5, Drizzle ORM, Zod validation via generated OpenAPI schemas
- **Database:** PostgreSQL — all data persists across restarts
- **API contract:** OpenAPI spec in `lib/api-spec/openapi.yaml`; hooks and Zod schemas auto-generated via Orval

## Data model

```
runbooks
  id          serial PRIMARY KEY
  title       text NOT NULL
  system      text NOT NULL          -- e.g. "GitHub Actions", "EKS", "Terraform"
  severity    text NOT NULL          -- "low" | "medium" | "high" | "critical"
  steps       text NOT NULL          -- plain text / markdown
  rollback    text NOT NULL          -- plain text / markdown
  tags        text NOT NULL          -- JSON array stored as string
  created_at  timestamp
  updated_at  timestamp
```

## Where things live

```
lib/api-spec/openapi.yaml        — OpenAPI contract (source of truth)
lib/api-client-react/            — Generated TanStack Query hooks
lib/api-zod/                     — Generated Zod request/response schemas
lib/db/src/schema/runbooks.ts    — Drizzle table definition
artifacts/api-server/src/routes/ — Express route handlers
artifacts/runbook/src/pages/     — React page components
```
