const express = require('express');
const { createDatabaseApp } = require('./server-app.js');

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

const vercelApp = express();
vercelApp.use(async (req, res, next) => {
    try {
        const app = await getApp();
        return app(req, res, next);
    } catch (error) {
        console.error('Vercel startup failed:', error?.message || 'Unknown error');
        return res.status(503).json({ success: false, message: 'Dịch vụ chưa sẵn sàng.' });
    }
});

module.exports = vercelApp;
