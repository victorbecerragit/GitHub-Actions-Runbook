import { Router } from "express";
import { db, runbooksTable } from "@workspace/db";
import { eq, ilike, sql, or } from "drizzle-orm";
import {
  ListRunbooksQueryParams,
  CreateRunbookBody,
  UpdateRunbookBody,
  GetRunbookParams,
  UpdateRunbookParams,
  DeleteRunbookParams,
} from "@workspace/api-zod";

const router = Router();

const SEED_DATA = [
  {
    title: "GitHub Actions: Workflow Fails on Push",
    system: "GitHub Actions",
    severity: "high" as const,
    steps: `1. Go to Actions tab in the GitHub repository.\n2. Click the failed workflow run to see the job logs.\n3. Identify the failing step and expand its log output.\n4. Check for common issues:\n   - Missing secrets (look for "secret not found" errors)\n   - Dependency installation failures\n   - Test failures with assertion errors\n5. If secrets are missing, go to Settings → Secrets and variables → Actions and add the required secret.\n6. If dependencies fail, check package.json/requirements.txt for version conflicts.\n7. Re-run the failed job from the Actions UI once the issue is resolved.`,
    rollback: `1. If a bad commit triggered the failure, revert it:\n   \`git revert HEAD && git push\`\n2. If the workflow itself was changed, revert the .github/workflows/ file.\n3. Disable the workflow temporarily via Settings → Actions → Workflows if needed.`,
    tags: ["ci", "github-actions", "pipeline"],
  },
  {
    title: "EKS Deploy: Pod CrashLoopBackOff",
    system: "EKS",
    severity: "critical" as const,
    steps: `1. Identify the crashing pod:\n   \`kubectl get pods -n <namespace>\`\n2. Inspect pod events and logs:\n   \`kubectl describe pod <pod-name> -n <namespace>\`\n   \`kubectl logs <pod-name> -n <namespace> --previous\`\n3. Common causes:\n   - OOMKilled: increase memory limits in the Deployment spec\n   - Config/secret missing: verify env vars with \`kubectl exec\`\n   - Image pull error: check ECR credentials and image tag\n4. If OOMKilled, patch the deployment:\n   \`kubectl set resources deployment <name> --limits=memory=512Mi\`\n5. If bad image, roll back:\n   \`kubectl rollout undo deployment/<name> -n <namespace>\`\n6. Monitor rollout:\n   \`kubectl rollout status deployment/<name> -n <namespace>\``,
    rollback: `1. Roll back the Deployment to the previous revision:\n   \`kubectl rollout undo deployment/<name> -n <namespace>\`\n2. Verify pods are running:\n   \`kubectl get pods -n <namespace> -w\`\n3. If rollback also fails, manually set a known-good image:\n   \`kubectl set image deployment/<name> <container>=<image>:<stable-tag>\``,
    tags: ["eks", "kubernetes", "pods", "incident"],
  },
  {
    title: "Terraform Apply: State Lock Conflict",
    system: "Terraform",
    severity: "medium" as const,
    steps: `1. Check if a lock exists in the S3 state backend (DynamoDB lock table).\n2. Run \`terraform plan\` to see if it fails with a lock error.\n3. Identify who holds the lock from the error message (includes Lock ID and Run ID).\n4. If the locking process is confirmed dead or stuck, force-unlock:\n   \`terraform force-unlock <LOCK_ID>\`\n5. Re-run \`terraform apply\` after unlocking.\n6. If CI/CD triggered the lock, check the pipeline run in GitHub Actions or your CI system.`,
    rollback: `1. Do NOT run \`terraform destroy\` unless explicitly required.\n2. If apply partially succeeded and left infra in a bad state:\n   - Identify the last known-good state from S3 versioning\n   - Pull that state file locally and use \`terraform state push\` with caution\n3. For new resource creation failures, remove the bad resource from state:\n   \`terraform state rm <resource.address>\``,
    tags: ["terraform", "iac", "state", "lock"],
  },
  {
    title: "GitHub Actions: Docker Build Cache Miss Causing Slow CI",
    system: "GitHub Actions",
    severity: "low" as const,
    steps: `1. Confirm the build is slow by comparing run durations in Actions tab.\n2. Check if \`actions/cache\` or Docker layer caching is configured.\n3. Add BuildKit cache to your workflow:\n   \`\`\`yaml\n   - uses: docker/build-push-action@v5\n     with:\n       cache-from: type=gha\n       cache-to: type=gha,mode=max\n   \`\`\`\n4. Ensure the Dockerfile is ordered with least-changing layers first (install deps before copying source).\n5. Commit and re-run — first run will be slow (cold cache); subsequent runs will be fast.`,
    rollback: `No rollback needed — this is a performance optimization.\nIf the cache causes incorrect builds, clear it:\n- Go to Actions → Caches and delete the affected cache entries.\n- Or add \`cache: false\` to the build step temporarily.`,
    tags: ["ci", "docker", "performance", "cache"],
  },
  {
    title: "EKS Deploy: Image Pull Error from Private ECR",
    system: "EKS",
    severity: "high" as const,
    steps: `1. Identify the pod with ImagePullBackOff:\n   \`kubectl get pods -n <namespace>\`\n2. Describe the pod to see the exact pull error:\n   \`kubectl describe pod <pod-name> -n <namespace>\`\n3. Verify the ECR image URI and tag exist:\n   \`aws ecr describe-images --repository-name <repo> --image-ids imageTag=<tag>\`\n4. Check the node IAM role has \`ecr:GetAuthorizationToken\` and \`ecr:BatchGetImage\` permissions.\n5. If using a cross-account ECR, verify the ECR resource policy allows the node role.\n6. Re-authenticate the node if needed:\n   \`aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com\`\n7. Force a pod restart after fixing permissions:\n   \`kubectl rollout restart deployment/<name> -n <namespace>\``,
    rollback: `1. Roll back to the last working image tag:\n   \`kubectl set image deployment/<name> <container>=<account>.dkr.ecr.<region>.amazonaws.com/<repo>:<stable-tag> -n <namespace>\`\n2. Verify rollout success:\n   \`kubectl rollout status deployment/<name> -n <namespace>\``,
    tags: ["eks", "ecr", "docker", "auth", "incident"],
  },
];

function parseTags(raw: string): string[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function formatRunbook(row: typeof runbooksTable.$inferSelect) {
  return {
    ...row,
    tags: parseTags(row.tags),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/runbooks
router.get("/runbooks", async (req, res): Promise<void> => {
  const parsed = ListRunbooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { search, system, severity, tag } = parsed.data;

  const rows = await db.select().from(runbooksTable);

  // Filter in JS to handle JSON tags and cross-field search simply
  let filtered = rows;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.system.toLowerCase().includes(q) ||
        r.steps.toLowerCase().includes(q) ||
        r.rollback.toLowerCase().includes(q)
    );
  }

  if (system) {
    filtered = filtered.filter(
      (r) => r.system.toLowerCase() === system.toLowerCase()
    );
  }

  if (severity) {
    filtered = filtered.filter((r) => r.severity === severity);
  }

  if (tag) {
    filtered = filtered.filter((r) => {
      const tags = parseTags(r.tags);
      return tags.includes(tag);
    });
  }

  res.json(filtered.map(formatRunbook));
});

// POST /api/runbooks
router.post("/runbooks", async (req, res): Promise<void> => {
  const parsed = CreateRunbookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { tags, ...rest } = parsed.data;
  const [row] = await db
    .insert(runbooksTable)
    .values({ ...rest, tags: JSON.stringify(tags ?? []) })
    .returning();

  res.status(201).json(formatRunbook(row));
});

// POST /api/runbooks/seed — must be before /:id
router.post("/runbooks/seed", async (req, res): Promise<void> => {
  const existing = await db.select().from(runbooksTable);
  if (existing.length > 0) {
    res.json({ inserted: 0, message: "Runbooks already exist, skipping seed." });
    return;
  }

  const rows = await db
    .insert(runbooksTable)
    .values(SEED_DATA.map((r) => ({ ...r, tags: JSON.stringify(r.tags) })))
    .returning();

  res.json({ inserted: rows.length, message: `Seeded ${rows.length} runbooks.` });
});

// GET /api/runbooks/stats — must be before /:id
router.get("/runbooks/stats", async (req, res): Promise<void> => {
  const rows = await db.select().from(runbooksTable);

  const bySeverity: Record<string, number> = {};
  const bySystem: Record<string, number> = {};

  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    bySystem[r.system] = (bySystem[r.system] ?? 0) + 1;
  }

  res.json({ total: rows.length, bySeverity, bySystem });
});

// GET /api/runbooks/:id
router.get("/runbooks/:id", async (req, res): Promise<void> => {
  const parsed = GetRunbookParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(runbooksTable)
    .where(eq(runbooksTable.id, parsed.data.id));

  if (!row) {
    res.status(404).json({ error: "Runbook not found" });
    return;
  }
  res.json(formatRunbook(row));
});

// PUT /api/runbooks/:id
router.put("/runbooks/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateRunbookParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateRunbookBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const { tags, ...rest } = bodyParsed.data;
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (tags !== undefined) {
    updateData.tags = JSON.stringify(tags);
  }

  const [row] = await db
    .update(runbooksTable)
    .set(updateData)
    .where(eq(runbooksTable.id, paramsParsed.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Runbook not found" });
    return;
  }
  res.json(formatRunbook(row));
});

// DELETE /api/runbooks/:id
router.delete("/runbooks/:id", async (req, res): Promise<void> => {
  const parsed = DeleteRunbookParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .delete(runbooksTable)
    .where(eq(runbooksTable.id, parsed.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Runbook not found" });
    return;
  }
  res.status(204).send();
});

export default router;
