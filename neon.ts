import { defineConfig } from '@neon/config/v1';

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} must be set in the local .env file before deploying to Neon.`);
    return value;
}

const bootstrap = process.env.BOOTSTRAP_ADMIN_USERNAME && process.env.BOOTSTRAP_ADMIN_PASSWORD
    ? {
        BOOTSTRAP_ADMIN_USERNAME: process.env.BOOTSTRAP_ADMIN_USERNAME,
        BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD
    }
    : {};

const publicOrigin = process.env.PUBLIC_ORIGIN ? { PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN } : {};

export default defineConfig({
    functions: {
        vivay: {
            name: 'VÍ VAY',
            source: './functions/vivay.mjs',
            env: {
                NODE_ENV: 'production',
                SESSION_SECRET: required('SESSION_SECRET'),
                OWNER_PRODUCTION_APPROVED: required('OWNER_PRODUCTION_APPROVED'),
                DB_POOL_MAX: process.env.DB_POOL_MAX || '3',
                ...bootstrap,
                ...publicOrigin
            }
        }
    }
});
