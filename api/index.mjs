import serverApp from '../server-app.js';

const { createDatabaseApp } = serverApp;
let appPromise;

async function getApp() {
    if (!appPromise) {
        appPromise = createDatabaseApp({ serverless: true }).then(({ app }) => app).catch((error) => {
            appPromise = undefined;
            throw error;
        });
    }
    return appPromise;
}

export default async function vercelHandler(req, res) {
    try {
        const app = await getApp();
        return app(req, res);
    } catch (error) {
        console.error('Vercel startup failed:', error?.message || 'Unknown error');
        return res.status(503).json({ success: false, message: 'Dịch vụ chưa sẵn sàng.' });
    }
}
