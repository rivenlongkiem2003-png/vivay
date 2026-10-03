# Legal/compliance review — technical release gate

Reviewed: 2026-10-03 (Asia/Bangkok). This is a technical risk review, **not legal advice** and not a conclusion that the project is lawful.

## Findings relevant to this source

1. The previous public pages included lending/approval/fast-disbursement claims and demanded unnecessary identity data. The public route is now restricted to protected record lookup and does not present loan offers, approval claims, countdowns, fake activity or payment pressure.
2. The actual operator, business model, licence/authorisation status, payment beneficiary and approved financial content are not evidenced in the repository. Whether a live service falls within regulated credit/payment activity cannot be determined from code. Vietnam's Law on Credit Institutions 32/2024/QH15 is in force from 2024-07-01 and was partially amended from 2025-10-15; qualified Vietnamese counsel must assess the real model and current applicable text before public launch.
3. The application processes personal data (at least name and phone; payment information may be personal data). Decree 13/2023/NĐ-CP on personal-data protection has been effective since 2023-07-01. The Law on Data 60/2024/QH15 has been effective since 2025-07-01. The operator must determine its lawful basis, notices, roles, retention, security controls, processor arrangements and any cross-border obligations. This build reduces new collection by removing CCCD and QR upload from the active flow; it does not itself establish a lawful basis for legacy data.
4. If the owner supplies financial services to consumers, consumer-protection rules are relevant. Law 19/2023/QH15 and Decree 55/2024/NĐ-CP have been effective since 2024-07-01. Fees, interest, term, identity of the supplier, contract and payment beneficiary must be truthful, approved and clear before a profile is made available. The UI deliberately warns users to independently verify payment details; it does not state that payment is completed.
5. A previously committed database URL was found in `restore_neon.js`, and a GitHub personal access token was embedded in the prior local Git remote URL. The script is disabled, the local remote was rewritten without the token, and no current source/working-tree secret is found by the repository scan; nevertheless both former credentials must be treated as compromised and rotated/revoked. Existing Git history is not rewritten without owner instruction.

## Technical controls implemented

- Admin authentication is server-side, rate limited and uses `scrypt` password hashes; the old cleartext admin password is converted at first successful legacy login.
- HttpOnly, SameSite=Strict signed sessions; CSRF token checks for state-changing requests; RBAC on every admin endpoint.
- Customer records are returned only to the authenticated customer session. Numeric admin IDs never act as public authorization; customer access needs an opaque 256-bit access code stored only as a hash.
- CSP, HSTS in production, noindex, static-file allow-list, minimal error messages and no public legacy configuration API.
- PII minimization: new records do not collect CCCD; the admin list masks phones; audit snapshots mask phone/account number.

## Required owner/counsel decisions before release

Complete every unchecked item in `LEGAL_DEPLOYMENT_CHECKLIST.md`, including the legal identity/operator, authority to use VÍ VAY assets, ownership/authority for each beneficiary account, approved privacy/terms and written production authorization. Obtain a counsel review of the actual model and final consumer-facing content. Do not use a Render deployment, public DNS, real customer records or migration until those approvals and a verified database backup exist.

## Primary sources consulted

- [Law on Credit Institutions 32/2024/QH15 — Government policy portal](https://xaydungchinhsach.chinhphu.vn/toan-van-luat-cac-to-chuc-tin-dung-119240405135841794.htm)
- [Legal-status history for Law 32/2024/QH15 — National legal database](https://vbpl.moj.gov.vn/boxaydung/Pages/vbpq-lichsu.aspx?ItemID=166170)
- [Decree 13/2023/NĐ-CP — personal-data protection](https://vanban.chinhphu.vn/?classid=0&docid=207759&pageid=27160)
- [Law on Data 60/2024/QH15 — National legal database](https://vbpl.moj.gov.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=174877&Keyword=)
- [Consumer Protection Law 19/2023/QH15](https://vanban.chinhphu.vn/?classid=1&docid=208363&orggroupid=1&pageid=27160&previousPage=other+articles)
- [Decree 55/2024/NĐ-CP](https://vanban.chinhphu.vn/?classid=1&docid=210254&pageid=27160&typegroupid=4)
