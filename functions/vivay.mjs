import crypto from 'node:crypto';
import { Hono } from 'hono';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClient from '@prisma/client';
import { attachDatabasePool } from '@neon/functions';
import legacy from '../app.js';
import { STATIC_ASSETS } from './generated-assets.mjs';

const { Pool } = pg;
const { PrismaClient } = prismaClient;

const {
    InputError,
    auditSnapshot,
    backfillSecureLoanAccess,
    bootstrapAdmin,
    changedSnapshots,
    generateAccessCode,
    generateLoanCode,
    hashAccessCode,
    maskValue,
    normalizeText,
    safeEqual,
    serializeAdminLoan,
    serializeLoan,
    toLoanInput,
    userDataFromInput,
    verifyPassword
} = legacy;

const SESSION_COOKIE = 'vivay_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function toBase64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, value) => {
        const separator = value.indexOf('=');
        if (separator === -1) return cookies;
        const key = value.slice(0, separator).trim();
        const content = value.slice(separator + 1).trim();
        if (key) cookies[key] = decodeURIComponent(content);
        return cookies;
    }, {});
}

function signSession(payload, secret) {
    const body = toBase64Url(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${signature}`;
}

function verifySession(token, secret) {
    if (!token || !secret) return null;
    const [body, signature] = String(token).split('.');
    if (!body || !signature) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        return payload && Number(payload.exp) > Date.now() ? payload : null;
    } catch {
        return null;
    }
}

function cookieValue(name, value, { secure = false, maxAge = 0 } = {}) {
    const attributes = [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${Math.floor(maxAge / 1000)}`
    ];
    if (secure) attributes.push('Secure');
    return attributes.join('; ');
}

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
    const hits = new Map();
    return (clientId, route) => {
        const key = `${clientId}:${route}`;
        const now = Date.now();
        const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
        recent.push(now);
        hits.set(key, recent);
        return recent.length <= max;
    };
}

function clientId(context) {
    return context.req.header('cf-connecting-ip') || context.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function parseRecordId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('ID hồ sơ không hợp lệ.');
    return id;
}

function getJson(context) {
    return context.req.json().catch(() => {
        throw new InputError('Nội dung yêu cầu phải là JSON hợp lệ.');
    });
}

function createDefaultPrismaProvider() {
    let prismaPromise;

    return async function getPrisma() {
        if (!prismaPromise) {
            prismaPromise = (async () => {
                const databaseUrl = process.env.DATABASE_URL;
                if (!databaseUrl) throw new Error('Neon did not inject DATABASE_URL for this Function.');
                const configuredPoolSize = Number(process.env.DB_POOL_MAX || 3);
                const poolSize = Number.isSafeInteger(configuredPoolSize) ? Math.min(10, Math.max(1, configuredPoolSize)) : 3;
                const pool = new Pool({
                    connectionString: databaseUrl,
                    max: poolSize,
                    connectionTimeoutMillis: 10_000,
                    idleTimeoutMillis: 30_000
                });
                attachDatabasePool(pool);
                const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
                await bootstrapAdmin(prisma);
                await backfillSecureLoanAccess(prisma);
                return prisma;
            })().catch((error) => {
                prismaPromise = undefined;
                throw error;
            });
        }
        return prismaPromise;
    };
}

function createVivayApp({
    getPrisma = createDefaultPrismaProvider(),
    sessionSecret = process.env.SESSION_SECRET || '',
    isProduction = process.env.NODE_ENV === 'production',
    publicOrigin = process.env.PUBLIC_ORIGIN || '',
    ownerApproved = process.env.OWNER_PRODUCTION_APPROVED === 'true',
    rateLimit = {}
} = {}) {
    const app = new Hono();
    const loginLimiter = createRateLimiter({ max: rateLimit.loginMax || 8, windowMs: rateLimit.loginWindowMs || 15 * 60 * 1000 });

    app.use('*', async (context, next) => {
        context.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'");
        context.header('X-Content-Type-Options', 'nosniff');
        context.header('Referrer-Policy', 'no-referrer');
        context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        context.header('X-Frame-Options', 'DENY');
        context.header('Cross-Origin-Opener-Policy', 'same-origin');
        context.header('Cross-Origin-Resource-Policy', 'same-origin');
        context.header('Cache-Control', 'no-store');
        context.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
        if (isProduction) {
            context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            if (!ownerApproved) return context.json({ success: false, message: 'Production release is blocked pending owner approval.' }, 503);
            if (sessionSecret.length < 32) return context.json({ success: false, message: 'Production session configuration is incomplete.' }, 503);
        }
        return next();
    });

    function isSecureRequest(context) {
        return isProduction || new URL(context.req.url).protocol === 'https:';
    }

    function setSession(context, subject) {
        const now = Date.now();
        const payload = {
            sub: subject.id,
            role: subject.role,
            username: subject.username || '',
            csrf: crypto.randomBytes(24).toString('base64url'),
            iat: now,
            exp: now + SESSION_MAX_AGE_MS
        };
        context.header('Set-Cookie', cookieValue(SESSION_COOKIE, signSession(payload, sessionSecret), { secure: isSecureRequest(context), maxAge: SESSION_MAX_AGE_MS }));
        return payload;
    }

    function clearSession(context) {
        context.header('Set-Cookie', cookieValue(SESSION_COOKIE, '', { secure: isSecureRequest(context), maxAge: 0 }));
    }

    function getSession(context) {
        return verifySession(parseCookies(context.req.header('cookie') || '')[SESSION_COOKIE], sessionSecret);
    }

    function requireSession(context) {
        const session = getSession(context);
        if (!session) return null;
        return session;
    }

    function requireAdmin(context) {
        const session = requireSession(context);
        if (!session) return { response: context.json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401) };
        if (session.role !== 'admin') return { response: context.json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' }, 403) };
        return { session };
    }

    function requireCustomer(context) {
        const session = requireSession(context);
        if (!session) return { response: context.json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401) };
        if (session.role !== 'customer') return { response: context.json({ success: false, message: 'Bạn không có quyền xem hồ sơ này.' }, 403) };
        return { session };
    }

    function requireCsrf(context, session) {
        const origin = context.req.header('origin');
        const expectedOrigin = publicOrigin || new URL(context.req.url).origin;
        if (origin && origin !== expectedOrigin) return context.json({ success: false, message: 'Origin không hợp lệ.' }, 403);
        if (!safeEqual(context.req.header('x-csrf-token') || '', session.csrf || '')) return context.json({ success: false, message: 'CSRF token không hợp lệ.' }, 403);
        return null;
    }

    async function uniqueLoanCode(prisma) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const loanCode = generateLoanCode();
            const existing = await prisma.user.findUnique({ where: { loanCode } });
            if (!existing) return loanCode;
        }
        throw new Error('Không thể tạo mã khoản vay duy nhất.');
    }

    async function audit(prisma, actorId, entityId, action, oldValue, newValue) {
        await prisma.auditLog.create({ data: { actorId, entityId, action, oldValue: oldValue ? JSON.stringify(oldValue) : null, newValue: newValue ? JSON.stringify(newValue) : null } });
    }

    async function databaseRoute(handler, context) {
        const prisma = await getPrisma();
        return handler(context, prisma);
    }

    app.get('/health', (context) => context.json({ status: 'ok', platform: 'neon-functions' }));

    app.post('/api/auth/admin', async (context) => databaseRoute(async (ctx, prisma) => {
        if (!loginLimiter(clientId(ctx), '/api/auth/admin')) return ctx.json({ success: false, message: 'Có quá nhiều lần thử. Vui lòng thử lại sau.' }, 429);
        const body = await getJson(ctx);
        const username = normalizeText(body?.username, 'Tên đăng nhập', { required: true, max: 80 });
        const password = normalizeText(body?.password, 'Mật khẩu', { required: true, max: 256 });
        const admin = await prisma.admin.findUnique({ where: { username } });
        let valid = false;
        let rotateLegacyPassword = false;
        if (admin?.passwordHash) valid = await verifyPassword(password, admin.passwordHash);
        else if (admin?.password) { valid = safeEqual(password, admin.password); rotateLegacyPassword = valid; }
        if (!valid || admin.role !== 'admin') return ctx.json({ success: false, message: 'Thông tin đăng nhập không hợp lệ.' }, 401);
        if (rotateLegacyPassword) await prisma.admin.update({ where: { id: admin.id }, data: { password: '', passwordHash: await legacy.hashPassword(password) } });
        const session = setSession(ctx, { id: admin.id, role: 'admin', username: admin.username });
        return ctx.json({ success: true, role: 'admin', csrfToken: session.csrf });
    }, context));

    app.post('/api/auth/customer', async (context) => databaseRoute(async (ctx, prisma) => {
        if (!loginLimiter(clientId(ctx), '/api/auth/customer')) return ctx.json({ success: false, message: 'Có quá nhiều lần thử. Vui lòng thử lại sau.' }, 429);
        const body = await getJson(ctx);
        const loanCode = normalizeText(body?.loanCode, 'Mã khoản vay', { required: true, max: 64 }).toUpperCase();
        const accessCode = normalizeText(body?.accessCode, 'Mã truy cập', { required: true, max: 128 });
        const user = await prisma.user.findUnique({ where: { loanCode } });
        if (!user?.accessTokenHash || !safeEqual(hashAccessCode(accessCode), user.accessTokenHash)) return ctx.json({ success: false, message: 'Thông tin truy cập không hợp lệ.' }, 401);
        const session = setSession(ctx, { id: user.id, role: 'customer' });
        return ctx.json({ success: true, role: 'customer', csrfToken: session.csrf });
    }, context));

    app.get('/api/session', (context) => {
        const session = requireSession(context);
        if (!session) return context.json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401);
        return context.json({ success: true, role: session.role, csrfToken: session.csrf, username: session.username || '' });
    });

    app.post('/api/logout', (context) => {
        const session = requireSession(context);
        if (!session) return context.json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401);
        const csrfError = requireCsrf(context, session);
        if (csrfError) return csrfError;
        clearSession(context);
        return context.json({ success: true });
    });

    app.get('/api/me/loan', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireCustomer(ctx);
        if (auth.response) return auth.response;
        const user = await prisma.user.findUnique({ where: { id: auth.session.sub } });
        if (!user) return ctx.json({ success: false, message: 'Hồ sơ không còn khả dụng.' }, 401);
        return ctx.json({ success: true, data: serializeLoan(user) });
    }, context));

    app.get('/api/admin/customers', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireAdmin(ctx);
        if (auth.response) return auth.response;
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        return ctx.json({ success: true, data: users.map(serializeAdminLoan) });
    }, context));

    app.get('/api/admin/customers/:id', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireAdmin(ctx);
        if (auth.response) return auth.response;
        const id = parseRecordId(ctx.req.param('id'));
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return ctx.json({ success: false, message: 'Không tìm thấy hồ sơ.' }, 404);
        return ctx.json({ success: true, data: serializeAdminLoan(user) });
    }, context));

    app.post('/api/admin/customers', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireAdmin(ctx);
        if (auth.response) return auth.response;
        const csrfError = requireCsrf(ctx, auth.session);
        if (csrfError) return csrfError;
        const input = toLoanInput(await getJson(ctx));
        const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
        if (existing) return ctx.json({ success: false, message: 'Số điện thoại đã tồn tại trong hồ sơ.' }, 409);
        const loanCode = await uniqueLoanCode(prisma);
        const accessCode = generateAccessCode();
        const user = await prisma.user.create({ data: { ...userDataFromInput(input), cccd: '', soTaiKhoan: '', nganHang: '', loanCode, accessTokenHash: hashAccessCode(accessCode), accessTokenLastRotatedAt: new Date() } });
        await audit(prisma, auth.session.sub, user.id, 'LOAN_RECORD_CREATED', null, auditSnapshot(user));
        return ctx.json({ success: true, data: serializeAdminLoan(user), customerAccessCode: accessCode, message: 'Đã tạo hồ sơ. Hãy chuyển mã truy cập qua kênh riêng tư; mã chỉ hiển thị một lần.' }, 201);
    }, context));

    app.patch('/api/admin/customers/:id', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireAdmin(ctx);
        if (auth.response) return auth.response;
        const csrfError = requireCsrf(ctx, auth.session);
        if (csrfError) return csrfError;
        const id = parseRecordId(ctx.req.param('id'));
        const before = await prisma.user.findUnique({ where: { id } });
        if (!before) return ctx.json({ success: false, message: 'Không tìm thấy hồ sơ.' }, 404);
        const input = toLoanInput(await getJson(ctx));
        if (input.phone !== before.phone) {
            const samePhone = await prisma.user.findUnique({ where: { phone: input.phone } });
            if (samePhone && samePhone.id !== before.id) return ctx.json({ success: false, message: 'Số điện thoại đã tồn tại trong hồ sơ.' }, 409);
        }
        const after = await prisma.user.update({ where: { id }, data: userDataFromInput(input) });
        const changes = changedSnapshots(before, after);
        if (Object.keys(changes.oldValue).length) await audit(prisma, auth.session.sub, id, 'LOAN_RECORD_UPDATED', changes.oldValue, changes.newValue);
        return ctx.json({ success: true, data: serializeAdminLoan(after), message: 'Đã cập nhật hồ sơ.' });
    }, context));

    app.post('/api/admin/customers/:id/access-code', async (context) => databaseRoute(async (ctx, prisma) => {
        const auth = requireAdmin(ctx);
        if (auth.response) return auth.response;
        const csrfError = requireCsrf(ctx, auth.session);
        if (csrfError) return csrfError;
        const id = parseRecordId(ctx.req.param('id'));
        const before = await prisma.user.findUnique({ where: { id } });
        if (!before) return ctx.json({ success: false, message: 'Không tìm thấy hồ sơ.' }, 404);
        const accessCode = generateAccessCode();
        await prisma.user.update({ where: { id }, data: { accessTokenHash: hashAccessCode(accessCode), accessTokenLastRotatedAt: new Date() } });
        await audit(prisma, auth.session.sub, id, 'CUSTOMER_ACCESS_CODE_ROTATED', { accessCode: '[redacted]' }, { accessCode: '[redacted]' });
        return ctx.json({ success: true, customerAccessCode: accessCode, message: 'Đã tạo mã truy cập mới; mã cũ không còn hiệu lực.' });
    }, context));

    app.all('/api', (context) => context.json({ success: false, message: 'Không tìm thấy API.' }, 404));
    app.all('/api/*', (context) => context.json({ success: false, message: 'Không tìm thấy API.' }, 404));

    app.get('*', (context) => {
        const asset = STATIC_ASSETS[context.req.path];
        if (!asset) return context.text('Không tìm thấy trang.', 404);
        context.header('Content-Type', asset.contentType);
        return context.body(Buffer.from(asset.body, 'base64'));
    });

    app.onError((error, context) => {
        if (error instanceof InputError) return context.json({ success: false, message: error.message }, 400);
        if (error?.code === 'P2002') return context.json({ success: false, message: 'Dữ liệu đã tồn tại.' }, 409);
        if (error?.code === 'P2025') return context.json({ success: false, message: 'Không tìm thấy hồ sơ.' }, 404);
        console.error('Request failed', { route: context.req.path, method: context.req.method, error: error?.name || 'UnknownError' });
        return context.json({ success: false, message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }, 500);
    });

    return app;
}

const app = createVivayApp();

export { createVivayApp };
export default app;
