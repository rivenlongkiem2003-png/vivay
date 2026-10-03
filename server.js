require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { backfillSecureLoanAccess, bootstrapAdmin, createApp } = require('./app');

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    const sessionSecret = process.env.SESSION_SECRET;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET with at least 32 characters is required.');

    const isProduction = process.env.NODE_ENV === 'production';
    const publicOrigin = process.env.PUBLIC_ORIGIN || '';
    if (isProduction && process.env.OWNER_PRODUCTION_APPROVED !== 'true') {
        throw new Error('Production is blocked until the project owner records OWNER_PRODUCTION_APPROVED=true after completing the legal deployment checklist.');
    }
    if (isProduction && !/^https:\/\/.+/.test(publicOrigin)) {
        throw new Error('PUBLIC_ORIGIN must provide an HTTPS origin when using the standalone Node server in production.');
    }
    const configuredPoolSize = Number(process.env.DB_POOL_MAX || 5);
    const poolSize = Number.isSafeInteger(configuredPoolSize) ? Math.min(20, Math.max(1, configuredPoolSize)) : 5;
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.DATABASE_SSL === 'true' || isProduction ? { rejectUnauthorized: false } : false,
        max: poolSize,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000
    });
        try {
        await pool.query(`
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'admin';
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "stkDoanhNghiep" TEXT DEFAULT '111139797';
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "nganHangChung" TEXT DEFAULT 'VIB - Ngân hàng TMCP Quốc tế Việt Nam';
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "tenChuDoanhNghiep" TEXT DEFAULT 'CTY TNHH CAO PHAN HA YEN';
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "linkQrCode" TEXT DEFAULT '';
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cccd" TEXT DEFAULT '';
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hanThanhToan" TEXT DEFAULT '';
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tienCanThanhToan" TEXT DEFAULT '0';
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tienGiaiNgan" TEXT DEFAULT '0';
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ngayGiaiNgan" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "soTaiKhoan" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nganHang" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loanCode" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loanStatus" TEXT DEFAULT 'CHƯA THANH TOÁN';
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feeOrInterestDisplay" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentAccountName" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentBank" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentAccountNumber" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessTokenHash" TEXT;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessTokenLastRotatedAt" TIMESTAMP(3);
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            CREATE TABLE IF NOT EXISTS "AuditLog" (
                "id" SERIAL PRIMARY KEY,
                "actorId" INTEGER,
                "entityId" INTEGER,
                "action" TEXT NOT NULL,
                "oldValue" TEXT,
                "newValue" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Đã tự động cập nhật cấu trúc database Neon thành công!");
    } catch (e) {
        console.log("Auto-migration note:", e.message);
    }
    
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await bootstrapAdmin(prisma);
    await backfillSecureLoanAccess(prisma);

    try {
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            await prisma.user.create({
                data: {
                    name: 'PHAN ANH VIỆT',
                    phone: '0931982889',
                    cccd: '727555555555',
                    ngayGiaiNgan: '17/7/2026',
                    hanThanhToan: '23/7/2026',
                    tienCanThanhToan: '2150000',
                    tienGiaiNgan: '1120000',
                    feeOrInterestDisplay: '22.00% / 25.00%',
                    loanStatus: 'CHƯA THANH TOÁN',
                    soTaiKhoan: '727888888888',
                    nganHang: 'Techcombank'
                }
            });
            await prisma.user.create({
                data: {
                    name: 'NGUYỄN HOÀNG NHI',
                    phone: '0357099485',
                    cccd: '727555555555',
                    ngayGiaiNgan: '20/08/2026',
                    hanThanhToan: '26/08/2026',
                    tienCanThanhToan: '5000000',
                    tienGiaiNgan: '1000000',
                    feeOrInterestDisplay: '22.00% / 25.00%',
                    loanStatus: 'CHƯA THANH TOÁN',
                    soTaiKhoan: '727888888888',
                    nganHang: 'Techcombank'
                }
            });
            await backfillSecureLoanAccess(prisma);
        }
    } catch (e) {
        console.log('Seed users note:', e.message);
    }

    const app = createApp({ prisma, sessionSecret, isProduction, publicOrigin });
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port, () => console.log(`VÍ VAY record service listening on port ${port}`));

    async function shutdown() {
        server.close();
        await prisma.$disconnect();
        await pool.end();
    }
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
}

main().catch((error) => {
    console.error('Startup failed:', error.message);
    process.exit(1);
});
