Use direct, minimal changes.
GitHub is the source of truth.
If migration scope, platform behavior, or compatibility is unclear, stop and ask instead of guessing.
Migrate one route or module per session, keeping the Replit deployment functional until all routes are verified on Cloudflare Workers.
If the app uses Replit-specific services or assumptions, flag each one explicitly and propose the Cloudflare equivalent before migrating it.
Do not rewrite the UI. If a UI change is unavoidable due to a hard incompatibility with Cloudflare Workers, stop and ask before proceeding.
Prefer small commits and preserve existing CRUD behavior.
Before coding, explain files to change.
After explaining files to change, wait for explicit user approval before writing any code.
After coding, summarize exact changes and how to test locally.
Use Cloudflare D1 with Wrangler migrations.
If a Wrangler migration would alter or drop existing data, stop and present the migration SQL for review before applying it.
Keep secrets out of the repo. Store secrets using `wrangler secret put` for production and a `.dev.vars` file (git-ignored) for local development.