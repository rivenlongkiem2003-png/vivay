# Implementation report — VÍ VAY

Date: 2026-10-03 (Asia/Bangkok)

## 1. Existing architecture

The starting project was a Node.js/Express app using Prisma/PostgreSQL with root-level static pages (`index.html`, `detail.html`, `admin.html`) and a single `server.js`. Initial access control was client-side/localStorage based; its admin APIs had no server-side authorization.

## 2. Files changed

- New server application boundary: `app.js`; minimal startup entry: `server.js`.
- Rebuilt public, customer record and admin interfaces: `index.html`, `detail.html`, `admin.html`, CSS/JS, `theme.css`.
- New VÍ VAY logo asset: `assets/vivay-logo.png`.
- Additive Prisma migration: `prisma/migrations/20261003000000_vivay_security_hardening/migration.sql`.
- Security/test tooling: `.env.example`, `.gitignore`, `scripts/`, `test/`, `api/index.mjs`, `vercel.json` and `docs/VERCEL_SUPABASE_DEPLOYMENT.md`.
- Governance documents in `docs/`.

## 3. DB changes

Additive only; no `DROP`, reset or data deletion:

- `User`: secure `loanCode`, status, fee/interest display, payment display fields, hashed customer access code and timestamps.
- `Admin`: password hash and role/timestamps.
- `AuditLog`: actor, entity, action, masked old/new values, timestamp.

Existing records receive a non-guessable loan code and hashed customer access code at safe application startup. Because the newly generated legacy access code is intentionally not exposed, an admin must issue a new access code through the protected dashboard before an existing customer can use the new flow. Back up and run review before any production migration.

## 4. Branding changes

- Product name, page titles, metadata, OG metadata, favicon route and admin/customer interfaces are VÍ VAY.
- Customer-provided logo is served only from `assets/vivay-logo.png`; provenance is recorded.
- Yellow/white design tokens are shared by all active pages; old `preview.html` is no longer a public route.

## 5. Form 1 changes

The customer view is a mobile-first record card with avatar initial, name, masked phone, status, generated loan code, payment/disbursement amounts, dates, fee/interest and payment account details. It is structurally inspired by the supplied reference, but is a new VÍ VAY component. It does not hard-code screenshot data and uses no individual from the reference.

## 6. Admin changes

- Admin creates/edits every displayed record field.
- `loanCode` is server-generated (`VV-YYYYMMDD-` plus 96 bits of random hexadecimal data) and readonly in the dashboard.
- A 256-bit access code is shown once on create/rotation for secure delivery outside the URL.
- Customer delete and QR upload are not exposed; this avoids irreversible deletion and unnecessary upload risk.

## 7. Security changes

- Server-side RBAC for every admin API; customers fetch only `/api/me/loan` for the ID held in their signed session.
- HttpOnly, SameSite=Strict HMAC-signed sessions; CSRF header checks for mutations; login rate limiting.
- Passwords use Node `scrypt`; a legacy cleartext password, if present in the database, is converted to a hash only after a correct first login. No hard-coded admin bypass exists.
- Body cap, allow-listed static files, DOM-safe admin rendering, generic errors, CSP, `nosniff`, HSTS in production, no-referrer, permissions policy, framing denial and noindex.
- `restore_neon.js` is disabled because it contained a committed database credential and logged sensitive legacy data. A GitHub token was also removed from the previous local remote URL. Both credentials must be rotated/revoked.

## 8. Privacy changes

New flows do not collect or display CCCD, do not offer QR/data uploads, do not place PII in URLs, mask phones in the admin table and mask phone/account values in audit snapshots. Legacy database fields were not destructively removed.

## 9. Tests performed

Passed locally:

| Check | Result |
| --- | --- |
| JavaScript syntax lint | Passed (13 files, including the Vercel Function entrypoint) |
| API integration: unauthenticated admin denial, hashed admin login, CSRF denial, create, customer-only record access, IDOR denial, update and audit | Passed |
| Security unit tests: scrypt verification, loan-code entropy/format, CSP/static exposure/legacy config denial | Passed |
| Vercel Function adapter | Uses the shared Express app and keeps the production approval gate before database initialization |
| Prisma schema validation | Passed |
| Build (`npm run build`) | Passed |
| Current tracked-file secret scan | Passed |
| Production release gate (synthetic environment) | Passed: startup refuses production without `OWNER_PRODUCTION_APPROVED=true` before any database connection |
| Git whitespace check | Passed |
| Dependency audit after non-breaking fix | **4 high findings remain** in Prisma's transitive `deepmerge-ts`/`mysql2` chain; only a breaking `prisma@6.19.3` downgrade was offered. Not force-applied. |

Browser E2E/responsive test passed against a temporary fake-data server using the host Chrome: responsive no-horizontal-overflow checks at 375, 390, 430, 768, 1024 and 1440 px; admin login/create; customer secure login; amount/payment-data render; copy button; and logout. Screenshots were visually checked at 375 px login, 390 px customer record and 1024 px admin. The workspace's Linux Playwright CLI runner itself lacks its expected Chrome distribution, so this verification used the installed Windows Chrome without adding a browser package to the repository. Production/browser tests against a real deploy still remain unverified.

## 10. GitHub commit

Pushed to `https://github.com/huyng1801/vivay` on `main` with commits `393c494` (`feat: secure Vi Vay record management`), `2725820` (`docs: record release security gates`) and `e735b2d` (`chore: prepare Render deployment`). The previous remote was replaced with this token-free URL; the exposed historical token still must be revoked/rotated.

## 11. Vercel + Supabase deployment

The repository now uses `api/index.js` as a Vercel Node.js Function and Supabase PostgreSQL through `DATABASE_URL`. Vercel builds from GitHub automatically; the database migration remains an explicit operator step. See `docs/VERCEL_SUPABASE_DEPLOYMENT.md`.

## 12. Production URL

None. Production status: `BLOCKED_PENDING_OWNER_APPROVAL`.

## 13. Known limitations

- No production database migration or backup was run; this avoids touching unknown production data.
- Production E2E/security-header verification remains unverified because no production URL is authorized.
- Dependency audit retains four high transitive Prisma findings pending an upstream-compatible upgrade/review.
- The project has no password-reset/second-factor workflow; the owner must define one before handling real records at scale.

## 14. Items requiring project-owner confirmation

All unchecked checklist items in `LEGAL_DEPLOYMENT_CHECKLIST.md`, especially operator identity/authority, VÍ VAY asset right, beneficiary-account authority, final fees/interest/terms, approved Privacy Policy/Terms, real-data basis, database/GitHub credential rotation or revocation, database backup and written production authorization.

## 15. Legal/compliance issues requiring qualified counsel

Whether the actual business model requires licensing/authorisation; final financial/consumer disclosures and contract terms; lawful basis/retention/processor/cross-border treatment for personal data; advertising and payment-account presentation. See `LEGAL_REVIEW.md` for the technical review and primary-source links. This report is not legal advice.
