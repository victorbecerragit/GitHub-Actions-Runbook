import {
  type CreateRunbookInput,
  RunbooksRepository,
  type RunbookSeverity,
  type UpdateRunbookInput,
} from "./lib/runbooks-repository"

interface Env {
  DB: D1Database
  ADMIN_API_TOKEN: string
}

const VALID_SEVERITIES: RunbookSeverity[] = ["low", "medium", "high", "critical"]

const SEED_DATA: CreateRunbookInput[] = [
  {
    title: "GitHub Actions: Workflow Fails on Push",
    system: "GitHub Actions",
    severity: "high",
    steps:
      "1. Go to Actions tab in the GitHub repository.\n2. Click the failed workflow run to see the job logs.\n3. Identify the failing step and expand its log output.\n4. Check for common issues:\n   - Missing secrets (look for secret not found errors)\n   - Dependency installation failures\n   - Test failures with assertion errors\n5. If secrets are missing, go to Settings -> Secrets and variables -> Actions and add the required secret.\n6. If dependencies fail, check package.json/requirements.txt for version conflicts.\n7. Re-run the failed job from the Actions UI once the issue is resolved.",
    rollback:
      "1. If a bad commit triggered the failure, revert it: git revert HEAD && git push\n2. If the workflow itself was changed, revert the .github/workflows/ file.\n3. Disable the workflow temporarily via Settings -> Actions -> Workflows if needed.",
    tags: ["ci", "github-actions", "pipeline"],
  },
  {
    title: "EKS Deploy: Pod CrashLoopBackOff",
    system: "EKS",
    severity: "critical",
    steps:
      "1. Identify the crashing pod with kubectl get pods.\n2. Inspect pod events and logs with kubectl describe and kubectl logs --previous.\n3. Check for OOMKilled, missing config/secret, or image pull errors.\n4. If OOMKilled, raise memory limits.\n5. If bad image, roll back deployment.\n6. Monitor rollout status.",
    rollback:
      "1. Roll back the Deployment to previous revision.\n2. Verify pods are running.\n3. If needed, set a known-good image tag manually.",
    tags: ["eks", "kubernetes", "pods", "incident"],
  },
  {
    title: "Terraform Apply: State Lock Conflict",
    system: "Terraform",
    severity: "medium",
    steps:
      "1. Check lock in state backend.\n2. Run terraform plan and inspect lock details.\n3. Confirm lock holder is stale.\n4. Run terraform force-unlock <LOCK_ID>.\n5. Re-run terraform apply.\n6. Check CI run that may have held the lock.",
    rollback:
      "1. Do not run terraform destroy unless explicitly required.\n2. If partially applied, recover from last known-good state with caution.\n3. Remove bad resources from state only when needed.",
    tags: ["terraform", "iac", "state", "lock"],
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isSeverity(value: unknown): value is RunbookSeverity {
  return typeof value === "string" && VALID_SEVERITIES.includes(value as RunbookSeverity)
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined
  }
  return value
}

function parseIdFromPath(pathname: string): number | null {
  const parts = pathname.split("/").filter(Boolean)
  const rawId = parts[2]
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return null
  }
  return id
}

function parseCreateBody(body: unknown):
  | { ok: true; data: CreateRunbookInput }
  | { ok: false; details: string[] } {
  if (!isRecord(body)) {
    return { ok: false, details: ["Request body must be an object"] }
  }

  const details: string[] = []
  const tags = asStringArray(body.tags)

  if (!isNonEmptyString(body.title)) {
    details.push("title is required")
  }
  if (!isNonEmptyString(body.system)) {
    details.push("system is required")
  }
  if (!isSeverity(body.severity)) {
    details.push("severity must be one of low, medium, high, critical")
  }
  if (!isNonEmptyString(body.steps)) {
    details.push("steps is required")
  }
  if (!isNonEmptyString(body.rollback)) {
    details.push("rollback is required")
  }
  if (body.tags !== undefined && tags === undefined) {
    details.push("tags must be an array of strings")
  }

  if (details.length > 0) {
    return { ok: false, details }
  }

  const title = body.title as string
  const system = body.system as string
  const severity = body.severity as RunbookSeverity
  const steps = body.steps as string
  const rollback = body.rollback as string

  return {
    ok: true,
    data: {
      title,
      system,
      severity,
      steps,
      rollback,
      tags: tags ?? [],
    },
  }
}

function parseUpdateBody(body: unknown):
  | { ok: true; data: UpdateRunbookInput }
  | { ok: false } {
  if (!isRecord(body)) {
    return { ok: false }
  }

  const data: UpdateRunbookInput = {}

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) {
      return { ok: false }
    }
    data.title = body.title
  }

  if (body.system !== undefined) {
    if (!isNonEmptyString(body.system)) {
      return { ok: false }
    }
    data.system = body.system
  }

  if (body.severity !== undefined) {
    if (!isSeverity(body.severity)) {
      return { ok: false }
    }
    data.severity = body.severity
  }

  if (body.steps !== undefined) {
    if (!isNonEmptyString(body.steps)) {
      return { ok: false }
    }
    data.steps = body.steps
  }

  if (body.rollback !== undefined) {
    if (!isNonEmptyString(body.rollback)) {
      return { ok: false }
    }
    data.rollback = body.rollback
  }

  if (body.tags !== undefined) {
    const tags = asStringArray(body.tags)
    if (!tags) {
      return { ok: false }
    }
    data.tags = tags
  }

  return { ok: true, data }
}

function parseListQuery(url: URL):
  | { ok: true; data: { search?: string; system?: string; severity?: RunbookSeverity; tag?: string } }
  | { ok: false } {
  const search = url.searchParams.get("search")?.trim()
  const system = url.searchParams.get("system")?.trim()
  const severity = url.searchParams.get("severity")?.trim()
  const tag = url.searchParams.get("tag")?.trim()

  if (severity && !isSeverity(severity)) {
    return { ok: false }
  }

  return {
    ok: true,
    data: {
      search: search || undefined,
      system: system || undefined,
      severity: severity as RunbookSeverity | undefined,
      tag: tag || undefined,
    },
  }
}

function isAuthorizedWrite(request: Request, env: Env): boolean {
  const configuredToken = env.ADMIN_API_TOKEN?.trim()
  if (!configuredToken) {
    return false
  }

  const providedToken = request.headers.get("x-admin-token")?.trim()
  return providedToken === configuredToken
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const repo = new RunbooksRepository(env.DB)

    if (url.pathname === "/api/healthz") {
      return Response.json({ status: "ok" })
    }

    if (url.pathname === "/api/runbooks" && request.method === "GET") {
      const parsedQuery = parseListQuery(url)
      if (!parsedQuery.ok) {
        return Response.json({ error: "Invalid query parameters" }, { status: 400 })
      }

      const rows = await repo.listRunbooks()
      const { search, system, severity, tag } = parsedQuery.data

      let filtered = rows

      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.system.toLowerCase().includes(q) ||
            r.steps.toLowerCase().includes(q) ||
            r.rollback.toLowerCase().includes(q),
        )
      }

      if (system) {
        filtered = filtered.filter((r) => r.system.toLowerCase() === system.toLowerCase())
      }

      if (severity) {
        filtered = filtered.filter((r) => r.severity === severity)
      }

      if (tag) {
        filtered = filtered.filter((r) => r.tags.includes(tag))
      }

      return Response.json(filtered)
    }

    if (url.pathname === "/api/runbooks" && request.method === "POST") {
      if (!isAuthorizedWrite(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      const body = await request.json().catch(() => null)
      const parsedBody = parseCreateBody(body)

      if (!parsedBody.ok) {
        return Response.json(
          { error: "Validation failed", details: parsedBody.details },
          { status: 400 },
        )
      }

      const created = await repo.createRunbook(parsedBody.data)
      return Response.json(created, { status: 201 })
    }

    if (url.pathname === "/api/runbooks/seed" && request.method === "POST") {
      if (!isAuthorizedWrite(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      const existing = await repo.listRunbooks()

      if (existing.length > 0) {
        return Response.json({ inserted: 0, message: "Runbooks already exist, skipping seed." })
      }

      for (const entry of SEED_DATA) {
        await repo.createRunbook(entry)
      }

      return Response.json({ inserted: SEED_DATA.length, message: `Seeded ${SEED_DATA.length} runbooks.` })
    }

    if (url.pathname === "/api/runbooks/stats" && request.method === "GET") {
      const rows = await repo.listRunbooks()

      const bySeverity: Record<string, number> = {}
      const bySystem: Record<string, number> = {}

      for (const row of rows) {
        bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1
        bySystem[row.system] = (bySystem[row.system] ?? 0) + 1
      }

      return Response.json({ total: rows.length, bySeverity, bySystem })
    }

    if (url.pathname.startsWith("/api/runbooks/") && request.method === "GET") {
      const id = parseIdFromPath(url.pathname)

      if (id === null) {
        return Response.json({ error: "Invalid ID" }, { status: 400 })
      }

      const runbook = await repo.getRunbookById(id)

      if (!runbook) {
        return Response.json({ error: "Runbook not found" }, { status: 404 })
      }

      return Response.json(runbook)
    }

    if (url.pathname.startsWith("/api/runbooks/") && request.method === "PUT") {
      if (!isAuthorizedWrite(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      const id = parseIdFromPath(url.pathname)
      if (id === null) {
        return Response.json({ error: "Invalid ID" }, { status: 400 })
      }

      const body = await request.json().catch(() => null)
      const parsedBody = parseUpdateBody(body)

      if (!parsedBody.ok) {
        return Response.json({ error: "Validation failed" }, { status: 400 })
      }

      const updated = await repo.updateRunbook(id, parsedBody.data)
      if (!updated) {
        return Response.json({ error: "Runbook not found" }, { status: 404 })
      }

      return Response.json(updated)
    }

    if (url.pathname.startsWith("/api/runbooks/") && request.method === "DELETE") {
      if (!isAuthorizedWrite(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      const id = parseIdFromPath(url.pathname)
      if (id === null) {
        return Response.json({ error: "Invalid ID" }, { status: 400 })
      }

      const deleted = await repo.deleteRunbook(id)
      if (!deleted) {
        return Response.json({ error: "Runbook not found" }, { status: 404 })
      }

      return new Response(null, { status: 204 })
    }

    return new Response("Worker foundation ready", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  },
} satisfies ExportedHandler
