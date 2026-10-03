/**
 * Legacy data-restore entry point intentionally disabled.
 *
 * The original script embedded a database credential, imported unverified data
 * and printed sensitive fields. It must not be run against any environment.
 * Use an owner-approved, reviewed migration/restore runbook with credentials
 * provided only through environment variables after the exposed credential has
 * been rotated. See docs/RISK_FINDINGS.md and docs/LEGAL_DEPLOYMENT_CHECKLIST.md.
 */

throw new Error('Legacy restore is disabled pending an approved, credential-safe restore runbook.');
