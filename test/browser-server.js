const { createApp } = require('../app');
const { createFakePrisma } = require('./helpers');

async function main() {
    const prisma = await createFakePrisma();
    const app = createApp({
        prisma,
        sessionSecret: 'browser-test-session-secret-that-is-longer-than-thirty-two-characters',
        rateLimit: { loginMax: 50 }
    });
    app.listen(4173, '127.0.0.1', () => console.log('Browser test server listening on http://127.0.0.1:4173'));
}

main().catch((error) => { console.error(error); process.exit(1); });
