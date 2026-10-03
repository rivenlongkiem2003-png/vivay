const { execFileSync } = require('child_process');
const { existsSync, readdirSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const targets = ['app-core.cjs', 'server-local.cjs', 'server-app.js', 'index.js', 'login.js', 'detail.js', 'admin.js'];
if (existsSync(join(root, 'functions'))) {
    readdirSync(join(root, 'functions')).filter((file) => /\.(?:js|mjs)$/.test(file) && file !== 'generated-assets.mjs').forEach((file) => targets.push(join('functions', file)));
}
if (existsSync(join(root, 'scripts'))) {
    readdirSync(join(root, 'scripts')).filter((file) => file.endsWith('.js')).forEach((file) => targets.push(join('scripts', file)));
}
if (existsSync(join(root, 'test'))) {
    readdirSync(join(root, 'test')).filter((file) => file.endsWith('.js')).forEach((file) => targets.push(join('test', file)));
}
targets.forEach((file) => execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' }));
console.log(`Syntax check passed for ${targets.length} JavaScript files.`);
