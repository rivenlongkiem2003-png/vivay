const assert = require('assert/strict');
const test = require('node:test');
const { createApp, generateLoanCode, hashPassword, verifyPassword } = require('../app-core.cjs');
const { createFakePrisma, startApp } = require('./helpers');

test('password hashing and generated loan codes have expected security properties', async () => {
    const hash = await hashPassword('a strong test password');
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPassword('a strong test password', hash), true);
    assert.equal(await verifyPassword('not the password', hash), false);
    const first = generateLoanCode(new Date('2026-10-03T00:00:00Z'));
    const second = generateLoanCode(new Date('2026-10-03T00:00:00Z'));
    assert.match(first, /^VV-20261003-[A-F0-9]{24}$/);
    assert.notEqual(first, second);
});

test('security headers are present and non-public source files are not served', async (t) => {
    const app = createApp({ prisma: await createFakePrisma(), sessionSecret: 'test-session-secret-that-is-longer-than-thirty-two-characters' });
    const service = await startApp(app);
    t.after(service.close);
    const home = await fetch(`${service.baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.match(home.headers.get('permissions-policy'), /camera=\(\)/);
    assert.match(home.headers.get('x-robots-tag'), /noindex/);
    const health = await fetch(`${service.baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const source = await fetch(`${service.baseUrl}/server-local.cjs`);
    assert.equal(source.status, 404);
    const legacyConfig = await fetch(`${service.baseUrl}/api/config`);
    assert.equal(legacyConfig.status, 404);
});
