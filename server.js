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
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await bootstrapAdmin(prisma);
    await backfillSecureLoanAccess(prisma);

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
