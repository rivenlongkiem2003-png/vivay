const { hashPassword } = require('../app');

function clone(value) {
    return structuredClone(value);
}

async function createFakePrisma() {
    const passwordHash = await hashPassword('Correct-Horse-Battery-Staple');
    const state = {
        users: [],
        admins: [{ id: 1, username: 'admin-demo', password: '', passwordHash, role: 'admin', stkDoanhNghiep: '', nganHangChung: '', tenChuDoanhNghiep: '', linkQrCode: '', createdAt: new Date(), updatedAt: new Date() }],
        auditLogs: []
    };
    const user = {
        async findUnique({ where }) {
            const [key, value] = Object.entries(where)[0];
            const item = state.users.find((entry) => entry[key] === value);
            return item ? clone(item) : null;
        },
        async findMany() { return clone([...state.users].sort((a, b) => b.createdAt - a.createdAt)); },
        async create({ data }) {
            const now = new Date();
            const record = { id: state.users.length + 1, createdAt: now, updatedAt: now, ...clone(data) };
            state.users.push(record);
            return clone(record);
        },
        async update({ where, data }) {
            const item = state.users.find((entry) => entry.id === where.id);
            if (!item) { const error = new Error('Missing'); error.code = 'P2025'; throw error; }
            Object.assign(item, clone(data), { updatedAt: new Date() });
            return clone(item);
        }
    };
    const admin = {
        async findUnique({ where }) {
            const [key, value] = Object.entries(where)[0];
            const item = state.admins.find((entry) => entry[key] === value);
            return item ? clone(item) : null;
        },
        async create({ data }) {
            const record = { id: state.admins.length + 1, createdAt: new Date(), updatedAt: new Date(), ...clone(data) };
            state.admins.push(record);
            return clone(record);
        },
        async update({ where, data }) {
            const item = state.admins.find((entry) => entry.id === where.id);
            Object.assign(item, clone(data), { updatedAt: new Date() });
            return clone(item);
        }
    };
    return { state, user, admin, auditLog: { async create({ data }) { const entry = { id: state.auditLogs.length + 1, createdAt: new Date(), ...clone(data) }; state.auditLogs.push(entry); return clone(entry); } } };
}

async function startApp(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                baseUrl: `http://127.0.0.1:${port}`,
                close: () => new Promise((done) => server.close(done))
            });
        });
    });
}

function cookie(response) {
    return response.headers.get('set-cookie').split(';')[0];
}

module.exports = { cookie, createFakePrisma, startApp };
