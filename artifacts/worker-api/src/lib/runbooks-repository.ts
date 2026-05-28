export type RunbookSeverity = "low" | "medium" | "high" | "critical"

export interface RunbookRecord {
  id: number
  title: string
  system: string
  severity: RunbookSeverity
  steps: string
  rollback: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateRunbookInput {
  title: string
  system: string
  severity: RunbookSeverity
  steps: string
  rollback: string
  tags?: string[]
}

export interface UpdateRunbookInput {
  title?: string
  system?: string
  severity?: RunbookSeverity
  steps?: string
  rollback?: string
  tags?: string[]
}

type RunbookRow = {
  id: number
  title: string
  system: string
  severity: RunbookSeverity
  steps: string
  rollback: string
  tags: string
  created_at: string
  updated_at: string
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function toIsoString(value: string): string {
  const asDate = new Date(value)
  return Number.isNaN(asDate.getTime()) ? value : asDate.toISOString()
}

function mapRow(row: RunbookRow): RunbookRecord {
  return {
    id: row.id,
    title: row.title,
    system: row.system,
    severity: row.severity,
    steps: row.steps,
    rollback: row.rollback,
    tags: parseTags(row.tags),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

export class RunbooksRepository {
  constructor(private readonly db: D1Database) {}

  async listRunbooks(): Promise<RunbookRecord[]> {
    const query = `
      SELECT id, title, system, severity, steps, rollback, tags, created_at, updated_at
      FROM runbooks
      ORDER BY id DESC
    `
    const result = await this.db.prepare(query).all<RunbookRow>()
    return (result.results ?? []).map(mapRow)
  }

  async getRunbookById(id: number): Promise<RunbookRecord | null> {
    const query = `
      SELECT id, title, system, severity, steps, rollback, tags, created_at, updated_at
      FROM runbooks
      WHERE id = ?
      LIMIT 1
    `
    const row = await this.db.prepare(query).bind(id).first<RunbookRow>()
    return row ? mapRow(row) : null
  }

  async createRunbook(input: CreateRunbookInput): Promise<RunbookRecord> {
    const insertQuery = `
      INSERT INTO runbooks (title, system, severity, steps, rollback, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `

    const tags = JSON.stringify(input.tags ?? [])
    const insertResult = await this.db
      .prepare(insertQuery)
      .bind(input.title, input.system, input.severity, input.steps, input.rollback, tags)
      .run()

    const createdId = Number(insertResult.meta.last_row_id)
    const created = await this.getRunbookById(createdId)

    if (!created) {
      throw new Error("Failed to fetch created runbook")
    }

    return created
  }

  async updateRunbook(id: number, input: UpdateRunbookInput): Promise<RunbookRecord | null> {
    const assignments: string[] = []
    const values: unknown[] = []

    if (input.title !== undefined) {
      assignments.push("title = ?")
      values.push(input.title)
    }

    if (input.system !== undefined) {
      assignments.push("system = ?")
      values.push(input.system)
    }

    if (input.severity !== undefined) {
      assignments.push("severity = ?")
      values.push(input.severity)
    }

    if (input.steps !== undefined) {
      assignments.push("steps = ?")
      values.push(input.steps)
    }

    if (input.rollback !== undefined) {
      assignments.push("rollback = ?")
      values.push(input.rollback)
    }

    if (input.tags !== undefined) {
      assignments.push("tags = ?")
      values.push(JSON.stringify(input.tags))
    }

    if (assignments.length === 0) {
      return this.getRunbookById(id)
    }

    assignments.push("updated_at = CURRENT_TIMESTAMP")

    const updateQuery = `
      UPDATE runbooks
      SET ${assignments.join(", ")}
      WHERE id = ?
    `

    values.push(id)
    const updateResult = await this.db.prepare(updateQuery).bind(...values).run()

    if ((updateResult.meta.changes ?? 0) === 0) {
      return null
    }

    return this.getRunbookById(id)
  }

  async deleteRunbook(id: number): Promise<boolean> {
    const deleteQuery = `
      DELETE FROM runbooks
      WHERE id = ?
    `

    const deleteResult = await this.db.prepare(deleteQuery).bind(id).run()
    return (deleteResult.meta.changes ?? 0) > 0
  }
}