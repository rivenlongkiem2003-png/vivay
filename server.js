const { createDatabaseApp } = require('./server-app');

async function main() {
    const { app, prisma, pool } = await createDatabaseApp({ serverless: false });
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
