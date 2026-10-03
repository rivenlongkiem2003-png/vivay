# Neon Functions deployment runbook

Status: **configuration ready; public production release remains blocked until the owner completes `LEGAL_DEPLOYMENT_CHECKLIST.md`.**

## Architecture

The `vivay` Neon Function serves the allow-listed VÍ VAY HTML/CSS/JS/logo assets and the API from the same HTTPS origin. The function uses the Postgres database on its Neon branch through the `DATABASE_URL` Neon injects at runtime. No database URL, password, or session key is committed to this repository.

`scripts/build-neon-assets.js` packages the public asset allow-list into the Function bundle before every Neon deployment. This avoids a second host, but means the Function deploy is intentionally larger than an API-only function.

## 1. Create the Neon project

1. In the Neon Console, create a project named `vivay` in **AWS AP Southeast 1 (Singapore)**. Neon Functions are available in this region.
2. Keep the default database and `main` branch. Do not put real customer data in the Free project.
3. Copy the project ID from the project settings. It is not the organisation ID from the Console URL.
4. Create a least-privilege Neon API key that can deploy Functions and access this project. Treat it as a secret.

## 2. Configure GitHub deployment secrets

In GitHub repository **Settings → Secrets and variables → Actions**, add these repository secrets:

| Secret | Value |
| --- | --- |
| `NEON_API_KEY` | New Neon API key for this project |
| `NEON_PROJECT_ID` | The `vivay` project ID |
| `NEON_BRANCH` | `main` |
| `SESSION_SECRET` | Generate at least 32 random bytes; never reuse a password |
| `OWNER_PRODUCTION_APPROVED` | `false` until the owner completes the legal checklist; then `true` |
| `BOOTSTRAP_ADMIN_USERNAME` | Initial admin user for the first deployment only |
| `BOOTSTRAP_ADMIN_PASSWORD` | New high-entropy password for the first deployment only |
| `PUBLIC_ORIGIN` | Leave empty for the Neon invocation URL; set the exact HTTPS custom domain later |

PowerShell command to generate `SESSION_SECRET` locally:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Never add `DATABASE_URL` as a GitHub secret for this workflow. The workflow calls `neon link`, which pulls the selected branch’s database URL into an ignored `.env` file only long enough to run the additive Prisma migration. Neon injects the URL directly into the deployed Function.

## 3. Deploy

1. Go to GitHub → **Actions** → **Deploy VÍ VAY to Neon**.
2. Select **Run workflow** on `main`.
3. The workflow runs lint, tests, secret scanning, static-asset preparation, `prisma migrate deploy`, then `neon deploy`.
4. When it finishes, open the Neon project or run `npx neon functions get vivay` in a linked local checkout to obtain the public invocation URL. Verify `GET /health` returns `{"status":"ok","platform":"neon-functions"}`.

The workflow is manual-only on purpose. It prevents an unreviewed Git push from changing a system that holds personal data.

## Local Neon commands

Use a local `.env` copied from `.env.example`; it is ignored by Git.

```powershell
npx neon link --project-id <project-id> --branch main --yes
npm run neon:prepare
npm run neon:migrate
npm run neon:plan
npm run neon:deploy
```

Run `npm run neon:plan` before an initial or significant deploy. `prisma migrate deploy` only applies committed migrations; never run `prisma migrate reset` against the Neon project.

## After the first successful admin bootstrap

Verify that the administrator can sign in, then delete `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` from GitHub Actions secrets. To remove the corresponding persisted Function variables, use the Neon CLI’s targeted environment update or redeploy the Function without those variables after confirming the current Neon CLI behavior. Keep a documented, owner-approved recovery process instead.

## Operational and security notes

- Neon Functions run on Node.js 24. The project’s Node engine permits Node 22–24 for local tooling.
- `DB_POOL_MAX` defaults to `3`, deliberately lower than a traditional server because each warm serverless isolate maintains its own pool.
- The Function derives a same-origin CSRF check from its invocation URL when `PUBLIC_ORIGIN` is empty. Set `PUBLIC_ORIGIN=https://your-domain.example` and redeploy before serving a custom domain.
- `OWNER_PRODUCTION_APPROVED` is still a runtime gate. A value other than literal `true` returns HTTP 503 for every route, including the UI.
- A Free Neon project has quota and availability limits. It is suitable for testing, not a substitute for approved production data handling, backups, or monitoring.

## References

- [Neon Functions overview](https://neon.com/blog/neon-functions-backend-logic-next-to-your-data)
- [Neon Function environment variables](https://github.com/neondatabase/website/blob/main/content/docs/compute/functions/environment-variables.md)
- [Neon Prisma pooled connections](https://neon.com/blog/better-postgres-with-prisma-experience)
