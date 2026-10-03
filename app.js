const crypto = require('crypto');
const express = require('express');
const path = require('path');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'vivay_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_MONEY = 1_000_000_000_000;

function toBase64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('base64url');
    const derived = await scrypt(String(password), salt, 64);
    return `scrypt$${salt}$${derived.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
    const [algorithm, salt, encodedHash] = String(storedHash || '').split('$');
    if (algorithm !== 'scrypt' || !salt || !encodedHash) return false;
    const derived = await scrypt(String(password), salt, 64);
    return safeEqual(derived.toString('base64url'), encodedHash);
}

function hashAccessCode(accessCode) {
    return crypto.createHash('sha256').update(String(accessCode)).digest('hex');
}

function generateAccessCode() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateLoanCode(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `VV-${date}-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
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

function maskValue(value) {
    const raw = String(value || '');
    if (!raw) return '';
    if (raw.length <= 4) return '****';
    return `${raw.slice(0, 2)}${'*'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-2)}`;
}

function normalizeText(value, field, { required = false, max = 160 } = {}) {
    if (value === undefined || value === null) {
        if (required) throw new InputError(`${field} là bắt buộc.`);
        return '';
    }
    const normalized = String(value).trim().replace(/\s+/g, ' ');
    if (required && !normalized) throw new InputError(`${field} là bắt buộc.`);
    if (normalized.length > max) throw new InputError(`${field} vượt quá ${max} ký tự.`);
    return normalized;
}

function normalizePhone(value) {
    const phone = normalizeText(value, 'Số điện thoại', { required: true, max: 20 }).replace(/[\s().-]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(phone)) throw new InputError('Số điện thoại không hợp lệ.');
    return phone;
}

function normalizeMoney(value, field) {
    if (value === '' || value === null || value === undefined) return '0';
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_MONEY) {
        throw new InputError(`${field} phải là số nguyên từ 0 đến ${MAX_MONEY.toLocaleString('vi-VN')}.`);
    }
    return String(parsed);
}

function normalizeDate(value, field) {
    const date = normalizeText(value, field, { max: 10 });
    if (!date) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        throw new InputError(`${field} phải theo định dạng YYYY-MM-DD.`);
    }
    return date;
}

function toLoanInput(body) {
    const value = body || {};
    return {
        name: normalizeText(value.customerName ?? value.name, 'Họ tên', { required: true, max: 120 }),
        phone: normalizePhone(value.customerPhone ?? value.phone),
        loanStatus: normalizeText(value.loanStatus, 'Trạng thái khoản vay', { required: true, max: 80 }),
        paymentAmount: normalizeMoney(value.loanAmount ?? value.phaiTT, 'Số tiền cần thanh toán'),
        disbursedAmount: normalizeMoney(value.disbursedAmount ?? value.goc, 'Số tiền giải ngân'),
        disbursementDate: normalizeDate(value.disbursementDate ?? value.ngayGiaiNgan, 'Ngày giải ngân'),
        dueDate: normalizeDate(value.dueDate ?? value.hanTT, 'Ngày trả'),
        feeOrInterestDisplay: normalizeText(value.feeOrInterestDisplay, 'Phí/lãi hiển thị', { max: 120 }),
        paymentAccountName: normalizeText(value.paymentAccountName, 'Tên chủ tài khoản thanh toán', { max: 120 }),
        paymentBank: normalizeText(value.paymentBank, 'Ngân hàng thanh toán', { max: 120 }),
        paymentAccountNumber: normalizeText(value.paymentAccountNumber, 'Số tài khoản thanh toán', { max: 40 }).replace(/\s/g, '')
    };
}

function userDataFromInput(input) {
    return {
        name: input.name,
        phone: input.phone,
        hanThanhToan: input.dueDate,
        tienCanThanhToan: input.paymentAmount,
        tienGiaiNgan: input.disbursedAmount,
        ngayGiaiNgan: input.disbursementDate || null,
        loanStatus: input.loanStatus,
        feeOrInterestDisplay: input.feeOrInterestDisplay || null,
        paymentAccountName: input.paymentAccountName || null,
        paymentBank: input.paymentBank || null,
        paymentAccountNumber: input.paymentAccountNumber || null
    };
}

function serializeLoan(user) {
    return {
        customerName: user.name,
        customerPhone: user.phone,
        loanCode: user.loanCode,
        loanStatus: user.loanStatus,
        loanAmount: Number(user.tienCanThanhToan) || 0,
        disbursedAmount: Number(user.tienGiaiNgan) || 0,
        disbursementDate: user.ngayGiaiNgan || '',
        dueDate: user.hanThanhToan || '',
        feeOrInterestDisplay: user.feeOrInterestDisplay || '',
        paymentAccountName: user.paymentAccountName || '',
        paymentBank: user.paymentBank || '',
        paymentAccountNumber: user.paymentAccountNumber || ''
    };
}

function serializeAdminLoan(user) {
    return { id: user.id, ...serializeLoan(user), createdAt: user.createdAt, updatedAt: user.updatedAt };
}

function auditSnapshot(user) {
    const loan = serializeLoan(user);
    return {
        ...loan,
        customerPhone: maskValue(loan.customerPhone),
        paymentAccountNumber: maskValue(loan.paymentAccountNumber)
    };
}

function changedSnapshots(before, after) {
    const oldValue = auditSnapshot(before);
    const newValue = auditSnapshot(after);
    const changes = { oldValue: {}, newValue: {} };
    Object.keys(newValue).forEach((key) => {
        if (oldValue[key] !== newValue[key]) {
            changes.oldValue[key] = oldValue[key];
            changes.newValue[key] = newValue[key];
        }
    });
    return changes;
}

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
    const hits = new Map();
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
        recent.push(now);
        hits.set(key, recent);
        if (recent.length > max) return res.status(429).json({ success: false, message: 'Có quá nhiều lần thử. Vui lòng thử lại sau.' });
        return next();
    };
}

class InputError extends Error {}

function createApp({ prisma, sessionSecret, isProduction = process.env.NODE_ENV === 'production', publicOrigin = process.env.PUBLIC_ORIGIN || '', rateLimit = {} }) {
    if (!prisma) throw new Error('Prisma client is required.');
    if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use((req, res, next) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        next();
    });
    app.use(express.json({ limit: '64kb', type: 'application/json' }));

    function isSecureRequest(req) {
        return isProduction || req.secure || req.get('x-forwarded-proto') === 'https';
    }

    function setSession(res, req, subject) {
        const now = Date.now();
        const payload = { sub: subject.id, role: subject.role, username: subject.username || '', csrf: crypto.randomBytes(24).toString('base64url'), iat: now, exp: now + SESSION_MAX_AGE_MS };
        res.setHeader('Set-Cookie', cookieValue(SESSION_COOKIE, signSession(payload, sessionSecret), { secure: isSecureRequest(req), maxAge: SESSION_MAX_AGE_MS }));
        return payload;
    }

    function clearSession(res, req) {
        res.setHeader('Set-Cookie', cookieValue(SESSION_COOKIE, '', { secure: isSecureRequest(req), maxAge: 0 }));
    }

    function getSession(req) {
        return verifySession(parseCookies(req.headers.cookie || '')[SESSION_COOKIE], sessionSecret);
    }

    function requireSession(req, res, next) {
        const session = getSession(req);
        if (!session) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
        req.session = session;
        return next();
    }

    function requireAdmin(req, res, next) {
        if (!req.session || req.session.role !== 'admin') return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        return next();
    }

    function requireCustomer(req, res, next) {
        if (!req.session || req.session.role !== 'customer') return res.status(403).json({ success: false, message: 'Bạn không có quyền xem hồ sơ này.' });
        return next();
    }

    function requireCsrf(req, res, next) {
        const origin = req.get('origin');
        if (publicOrigin && origin && origin !== publicOrigin) return res.status(403).json({ success: false, message: 'Origin không hợp lệ.' });
        if (!req.session || !safeEqual(req.get('x-csrf-token') || '', req.session.csrf || '')) return res.status(403).json({ success: false, message: 'CSRF token không hợp lệ.' });
        return next();
    }

    async function uniqueLoanCode() {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const loanCode = generateLoanCode();
            const existing = await prisma.user.findUnique({ where: { loanCode } });
            if (!existing) return loanCode;
        }
        throw new Error('Không thể tạo mã khoản vay duy nhất.');
    }

    async function audit(actorId, entityId, action, oldValue, newValue) {
        await prisma.auditLog.create({ data: { actorId, entityId, action, oldValue: oldValue ? JSON.stringify(oldValue) : null, newValue: newValue ? JSON.stringify(newValue) : null } });
    }

    const loginLimiter = createRateLimiter({ max: rateLimit.loginMax || 8, windowMs: rateLimit.loginWindowMs || 15 * 60 * 1000 });

    app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get('/detail.html', (req, res) => res.sendFile(path.join(__dirname, 'detail.html')));
    app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
    app.get('/index.css', (req, res) => res.sendFile(path.join(__dirname, 'index.css')));
    app.get('/detail.css', (req, res) => res.sendFile(path.join(__dirname, 'detail.css')));
    app.get('/admin.css', (req, res) => res.sendFile(path.join(__dirname, 'admin.css')));
    app.get('/theme.css', (req, res) => res.sendFile(path.join(__dirname, 'theme.css')));
    app.get('/login.js', (req, res) => res.sendFile(path.join(__dirname, 'login.js')));
    app.get('/detail.js', (req, res) => res.sendFile(path.join(__dirname, 'detail.js')));
    app.get('/admin.js', (req, res) => res.sendFile(path.join(__dirname, 'admin.js')));
    app.get(['/favicon.ico', '/assets/vivay-logo.png'], (req, res) => res.sendFile(path.join(__dirname, 'assets', 'vivay-logo.png')));
    app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

    app.post('/api/auth/admin', loginLimiter, async (req, res, next) => {
        try {
            const username = normalizeText(req.body?.username, 'Tên đăng nhập', { required: true, max: 80 });
            const password = normalizeText(req.body?.password, 'Mật khẩu', { required: true, max: 256 });
            const admin = await prisma.admin.findUnique({ where: { username } });
            let valid = false;
            let rotateLegacyPassword = false;
            if (admin?.passwordHash) valid = await verifyPassword(password, admin.passwordHash);
            else if (admin?.password) { valid = safeEqual(password, admin.password); rotateLegacyPassword = valid; }
            if (!valid || admin.role !== 'admin') return res.status(401).json({ success: false, message: 'Thông tin đăng nhập không hợp lệ.' });
            if (rotateLegacyPassword) await prisma.admin.update({ where: { id: admin.id }, data: { password: '', passwordHash: await hashPassword(password) } });
            const session = setSession(res, req, { id: admin.id, role: 'admin', username: admin.username });
            return res.json({ success: true, role: 'admin', csrfToken: session.csrf });
        } catch (error) { return next(error); }
    });

    app.post('/api/auth/customer', loginLimiter, async (req, res, next) => {
        try {
            const loanCode = normalizeText(req.body?.loanCode, 'Mã khoản vay', { required: true, max: 64 }).toUpperCase();
            const accessCode = normalizeText(req.body?.accessCode, 'Mã truy cập', { required: true, max: 128 });
            const user = await prisma.user.findUnique({ where: { loanCode } });
            if (!user?.accessTokenHash || !safeEqual(hashAccessCode(accessCode), user.accessTokenHash)) return res.status(401).json({ success: false, message: 'Thông tin truy cập không hợp lệ.' });
            const session = setSession(res, req, { id: user.id, role: 'customer' });
            return res.json({ success: true, role: 'customer', csrfToken: session.csrf });
        } catch (error) { return next(error); }
    });

    app.get('/api/session', requireSession, (req, res) => res.json({ success: true, role: req.session.role, csrfToken: req.session.csrf, username: req.session.username || '' }));

    app.post('/api/logout', requireSession, requireCsrf, (req, res) => { clearSession(res, req); res.json({ success: true }); });

    app.get('/api/me/loan', requireSession, requireCustomer, async (req, res, next) => {
        try {
            const user = await prisma.user.findUnique({ where: { id: req.session.sub } });
            if (!user) return res.status(401).json({ success: false, message: 'Hồ sơ không còn khả dụng.' });
            return res.json({ success: true, data: serializeLoan(user) });
        } catch (error) { return next(error); }
    });

    app.get('/api/admin/customers', requireSession, requireAdmin, async (req, res, next) => {
        try {
            const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
            return res.json({ success: true, data: users.map(serializeAdminLoan) });
        } catch (error) { return next(error); }
    });

    app.get('/api/admin/customers/:id', requireSession, requireAdmin, async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('ID hồ sơ không hợp lệ.');
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ.' });
            return res.json({ success: true, data: serializeAdminLoan(user) });
        } catch (error) { return next(error); }
    });

    app.post('/api/admin/customers', requireSession, requireAdmin, requireCsrf, async (req, res, next) => {
        try {
            const input = toLoanInput(req.body);
            const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
            if (existing) return res.status(409).json({ success: false, message: 'Số điện thoại đã tồn tại trong hồ sơ.' });
            const loanCode = await uniqueLoanCode();
            const accessCode = generateAccessCode();
            const user = await prisma.user.create({ data: { ...userDataFromInput(input), cccd: '', soTaiKhoan: '', nganHang: '', loanCode, accessTokenHash: hashAccessCode(accessCode), accessTokenLastRotatedAt: new Date() } });
            await audit(req.session.sub, user.id, 'LOAN_RECORD_CREATED', null, auditSnapshot(user));
            return res.status(201).json({ success: true, data: serializeAdminLoan(user), customerAccessCode: accessCode, message: 'Đã tạo hồ sơ. Hãy chuyển mã truy cập qua kênh riêng tư; mã chỉ hiển thị một lần.' });
        } catch (error) { return next(error); }
    });

    app.patch('/api/admin/customers/:id', requireSession, requireAdmin, requireCsrf, async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('ID hồ sơ không hợp lệ.');
            const before = await prisma.user.findUnique({ where: { id } });
            if (!before) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ.' });
            const input = toLoanInput(req.body);
            if (input.phone !== before.phone) {
                const samePhone = await prisma.user.findUnique({ where: { phone: input.phone } });
                if (samePhone && samePhone.id !== before.id) return res.status(409).json({ success: false, message: 'Số điện thoại đã tồn tại trong hồ sơ.' });
            }
            const after = await prisma.user.update({ where: { id }, data: userDataFromInput(input) });
            const changes = changedSnapshots(before, after);
            if (Object.keys(changes.oldValue).length) await audit(req.session.sub, id, 'LOAN_RECORD_UPDATED', changes.oldValue, changes.newValue);
            return res.json({ success: true, data: serializeAdminLoan(after), message: 'Đã cập nhật hồ sơ.' });
        } catch (error) { return next(error); }
    });

    app.post('/api/admin/customers/:id/access-code', requireSession, requireAdmin, requireCsrf, async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) throw new InputError('ID hồ sơ không hợp lệ.');
            const before = await prisma.user.findUnique({ where: { id } });
            if (!before) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ.' });
            const accessCode = generateAccessCode();
            await prisma.user.update({ where: { id }, data: { accessTokenHash: hashAccessCode(accessCode), accessTokenLastRotatedAt: new Date() } });
            await audit(req.session.sub, id, 'CUSTOMER_ACCESS_CODE_ROTATED', { accessCode: '[redacted]' }, { accessCode: '[redacted]' });
            return res.json({ success: true, customerAccessCode: accessCode, message: 'Đã tạo mã truy cập mới; mã cũ không còn hiệu lực.' });
        } catch (error) { return next(error); }
    });

    app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Không tìm thấy API.' }));
    app.use((req, res) => res.status(404).type('text/plain').send('Không tìm thấy trang.'));
    app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
        if (error instanceof InputError) return res.status(400).json({ success: false, message: error.message });
        if (error?.code === 'P2002') return res.status(409).json({ success: false, message: 'Dữ liệu đã tồn tại.' });
        if (error?.code === 'P2025') return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ.' });
        console.error('Request failed', { route: req.path, method: req.method, error: error?.name || 'UnknownError' });
        return res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' });
    });

    return app;
}

async function bootstrapAdmin(prisma) {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!username || !password) return false;
    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) return false;
    await prisma.admin.create({ data: { username, password: '', passwordHash: await hashPassword(password), role: 'admin', stkDoanhNghiep: '', nganHangChung: '', tenChuDoanhNghiep: '', linkQrCode: '' } });
    return true;
}

async function backfillSecureLoanAccess(prisma) {
    const users = await prisma.user.findMany({ where: { OR: [{ loanCode: null }, { accessTokenHash: null }] } });
    let updated = 0;
    for (const user of users) {
        let loanCode = user.loanCode;
        if (!loanCode) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const candidate = generateLoanCode();
                const collision = await prisma.user.findUnique({ where: { loanCode: candidate } });
                if (!collision) { loanCode = candidate; break; }
            }
        }
        if (!loanCode) throw new Error(`Could not generate loan code for user ${user.id}`);
        const accessCode = generateAccessCode();
        await prisma.user.update({ where: { id: user.id }, data: { loanCode, accessTokenHash: user.accessTokenHash || hashAccessCode(accessCode), accessTokenLastRotatedAt: user.accessTokenLastRotatedAt || new Date() } });
        updated += 1;
    }
    return updated;
}

module.exports = { InputError, backfillSecureLoanAccess, bootstrapAdmin, createApp, generateAccessCode, generateLoanCode, hashAccessCode, hashPassword, maskValue, serializeLoan, verifyPassword };
