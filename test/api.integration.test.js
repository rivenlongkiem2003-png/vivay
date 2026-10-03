const assert = require('assert/strict');
const test = require('node:test');
const { createApp } = require('../app-core.cjs');
const { cookie, createFakePrisma, startApp } = require('./helpers');

const secret = 'test-session-secret-that-is-longer-than-thirty-two-characters';
const loanPayload = {
    customerName: 'Nguyễn Văn Demo',
    customerPhone: '0900000000',
    loanStatus: 'Đang xử lý',
    loanAmount: 1000000,
    disbursedAmount: 800000,
    disbursementDate: '2026-10-01',
    dueDate: '2026-10-31',
    feeOrInterestDisplay: '2,00%/tháng',
    paymentAccountName: 'DEMO PAYMENT OWNER',
    paymentBank: 'DEMO BANK',
    paymentAccountNumber: '111100009797'
};

test('admin manages a record and customer can only retrieve their own record', async (t) => {
    const prisma = await createFakePrisma();
    const app = createApp({ prisma, sessionSecret: secret, rateLimit: { loginMax: 50 } });
    const service = await startApp(app);
    t.after(service.close);

    const anonymous = await fetch(`${service.baseUrl}/api/admin/customers`);
    assert.equal(anonymous.status, 401);

    const rejectedLogin = await fetch(`${service.baseUrl}/api/auth/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin-demo', password: 'wrong' }) });
    assert.equal(rejectedLogin.status, 401);

    const adminLogin = await fetch(`${service.baseUrl}/api/auth/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin-demo', password: 'Correct-Horse-Battery-Staple' }) });
    assert.equal(adminLogin.status, 200);
    const adminCookie = cookie(adminLogin);
    const adminSession = await adminLogin.json();
    assert.equal(adminLogin.headers.get('set-cookie').includes('HttpOnly'), true);
    assert.equal(adminLogin.headers.get('set-cookie').includes('SameSite=Strict'), true);

    const blockedCsrf = await fetch(`${service.baseUrl}/api/admin/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify(loanPayload) });
    assert.equal(blockedCsrf.status, 403);

    const created = await fetch(`${service.baseUrl}/api/admin/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminSession.csrfToken }, body: JSON.stringify(loanPayload) });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.match(createdBody.data.loanCode, /^VV-\d{8}-[A-F0-9]{24}$/);
    assert.equal(createdBody.customerAccessCode.length >= 40, true);
    assert.equal(prisma.state.users[0].cccd, '');
    assert.equal(prisma.state.auditLogs.length, 1);
    assert.equal(prisma.state.auditLogs[0].newValue.includes('111100009797'), false);

    const customerLogin = await fetch(`${service.baseUrl}/api/auth/customer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loanCode: createdBody.data.loanCode, accessCode: createdBody.customerAccessCode }) });
    assert.equal(customerLogin.status, 200);
    const customerCookie = cookie(customerLogin);
    const customerSession = await customerLogin.json();
    assert.ok(customerSession.csrfToken);

    const ownRecord = await fetch(`${service.baseUrl}/api/me/loan`, { headers: { Cookie: customerCookie } });
    assert.equal(ownRecord.status, 200);
    const ownBody = await ownRecord.json();
    assert.deepEqual(ownBody.data.paymentAccountNumber, loanPayload.paymentAccountNumber);
    assert.equal(Object.hasOwn(ownBody.data, 'cccd'), false);
    assert.equal(Object.hasOwn(ownBody.data, 'accessTokenHash'), false);

    const idor = await fetch(`${service.baseUrl}/api/admin/customers/${createdBody.data.id}`, { headers: { Cookie: customerCookie } });
    assert.equal(idor.status, 403);

    const update = await fetch(`${service.baseUrl}/api/admin/customers/${createdBody.data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': adminSession.csrfToken }, body: JSON.stringify({ ...loanPayload, loanAmount: 1200000 }) });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).data.loanAmount, 1200000);
    assert.equal(prisma.state.auditLogs.length, 2);
});
