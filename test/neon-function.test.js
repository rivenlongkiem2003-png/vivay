const assert = require('assert/strict');
const test = require('node:test');
const { createFakePrisma } = require('./helpers');

const secret = 'test-session-secret-that-is-longer-than-thirty-two-characters';
const baseUrl = 'https://vivay.neon.test';
const loanPayload = {
    customerName: 'Nguyễn Văn Neon',
    customerPhone: '0900000001',
    loanStatus: 'Đang xử lý',
    loanAmount: 1000000,
    disbursedAmount: 800000,
    disbursementDate: '2026-10-01',
    dueDate: '2026-10-31',
    feeOrInterestDisplay: '2,00%/tháng',
    paymentAccountName: 'NEON PAYMENT OWNER',
    paymentBank: 'NEON BANK',
    paymentAccountNumber: '111100009797'
};

function cookie(response) {
    return response.headers.get('set-cookie').split(';')[0];
}

async function neonApp(prisma) {
    const { createVivayApp } = await import('../functions/vivay.mjs');
    return createVivayApp({ getPrisma: async () => prisma, sessionSecret: secret, isProduction: true, ownerApproved: true, rateLimit: { loginMax: 50 } });
}

test('Neon Function serves the private UI and preserves authentication boundaries', async () => {
    const prisma = await createFakePrisma();
    const app = await neonApp(prisma);

    const home = await app.request(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /VÍ VAY/);
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(home.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');

    const source = await app.request(`${baseUrl}/server.js`);
    assert.equal(source.status, 404);

    const adminLogin = await app.request(`${baseUrl}/api/auth/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin-demo', password: 'Correct-Horse-Battery-Staple' })
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = cookie(adminLogin);
    const adminSession = await adminLogin.json();

    const csrfBlocked = await app.request(`${baseUrl}/api/admin/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify(loanPayload)
    });
    assert.equal(csrfBlocked.status, 403);

    const created = await app.request(`${baseUrl}/api/admin/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminSession.csrfToken, Origin: baseUrl },
        body: JSON.stringify(loanPayload)
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.match(createdBody.data.loanCode, /^VV-\d{8}-[A-F0-9]{24}$/);
    assert.equal(prisma.state.auditLogs[0].newValue.includes(loanPayload.paymentAccountNumber), false);

    const customerLogin = await app.request(`${baseUrl}/api/auth/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanCode: createdBody.data.loanCode, accessCode: createdBody.customerAccessCode })
    });
    assert.equal(customerLogin.status, 200);
    const customerCookie = cookie(customerLogin);

    const customerRecord = await app.request(`${baseUrl}/api/me/loan`, { headers: { Cookie: customerCookie } });
    assert.equal(customerRecord.status, 200);
    assert.equal((await customerRecord.json()).data.paymentAccountNumber, loanPayload.paymentAccountNumber);

    const forbidden = await app.request(`${baseUrl}/api/admin/customers/${createdBody.data.id}`, { headers: { Cookie: customerCookie } });
    assert.equal(forbidden.status, 403);
});

test('Neon Function blocks unapproved production releases', async () => {
    const { createVivayApp } = await import('../functions/vivay.mjs');
    const app = createVivayApp({ getPrisma: async () => { throw new Error('Database must not be reached.'); }, sessionSecret: secret, isProduction: true, ownerApproved: false });
    const response = await app.request(`${baseUrl}/health`);
    assert.equal(response.status, 503);
});
