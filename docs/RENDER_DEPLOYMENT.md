# Render deployment runbook

Status: **configuration ready; public production release remains blocked pending the owner confirmations in `LEGAL_DEPLOYMENT_CHECKLIST.md`.**

## What is configured in this repository

`render.yaml` defines a Node web service in the Singapore region with:

- build: `npm ci && npm run build`;
- additive Prisma migration before deploy: `npx prisma migrate deploy`;
- start: `npm start`;
- HTTP health check: `/health`;
- database pool cap of 5;
- generated `SESSION_SECRET` for Blueprint deployments;
- automatic deploy disabled, so a reviewed manual deploy is required.

The app listens on Render's `PORT`. On Render, it automatically uses `RENDER_EXTERNAL_HOSTNAME` for its canonical HTTPS origin. Set `PUBLIC_ORIGIN` only when a custom HTTPS domain should be canonical.

## Prerequisites — do not skip

1. Use a fresh GitHub credential after revoking/rotating the exposed token noted in `RISK_FINDINGS.md`.
2. Push commits `393c494` and `2725820` to the repository with that fresh credential.
3. Complete the owner/legal checklist and make a verified database backup.
4. Confirm the migration is additive and target database is the intended production database. Do not run `prisma migrate reset`.

## Create the service from the screen shown

1. In **New Web Service**, choose **Public Git Repository** and paste the token-free repository URL:
   `https://github.com/rivenlongkiem2003-png/cashvay`
2. Click **Connect**. If Render detects `render.yaml`, prefer **Blueprint** setup; otherwise create a Node Web Service with these exact fields:

   | Field | Value |
   | --- | --- |
   | Name | `vivay-records` (or a unique approved name) |
   | Region | Singapore |
   | Branch | `main` |
   | Build Command | `npm ci && npm run build` |
   | Pre-Deploy Command | `npx prisma migrate deploy` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |
   | Auto-Deploy | Off until release approval |

3. Add the environment variables below in Render's **Environment** section. Never put values in Git or `render.yaml`.

   | Variable | Value/source |
   | --- | --- |
   | `DATABASE_URL` | Production PostgreSQL connection string; use Render Postgres reference or a private provider URL |
   | `DATABASE_SSL` | `true` |
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | Use Render **Generate**; keep the generated value secret |
   | `DB_POOL_MAX` | `5` (lower if the database provider has a tighter connection limit) |
   | `BOOTSTRAP_ADMIN_USERNAME` | New initial admin username; set only for first bootstrap |
   | `BOOTSTRAP_ADMIN_PASSWORD` | New high-entropy initial password; set only for first bootstrap |
   | `OWNER_PRODUCTION_APPROVED` | Set to `true` only after written owner approval and the completed checklist |
   | `PUBLIC_ORIGIN` | Optional for first Render deploy; set to the exact custom HTTPS origin when using a custom domain |

4. Before pressing **Deploy Web Service**, review the migration and database backup. The service intentionally fails closed if `OWNER_PRODUCTION_APPROVED` is absent/not `true`.
5. After Render reports healthy, verify `/health`, login/admin/customer flows, security headers and browser console against the actual Render URL. Record results in `IMPLEMENTATION_REPORT.md`.

## Security notes

- Do not reuse the former GitHub token or database credential.
- If a custom domain is added, set `PUBLIC_ORIGIN=https://your-domain` and redeploy before using the domain.
- Initial bootstrap credentials are environment secrets, not source code. After the first successful admin bootstrap, remove `BOOTSTRAP_ADMIN_PASSWORD` from Render and retain an owner-approved admin recovery process.

## References

- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Render environment variables and secrets](https://render.com/docs/configure-environment-variables)
- [Render HTTP health checks](https://render.com/docs/health-checks)
