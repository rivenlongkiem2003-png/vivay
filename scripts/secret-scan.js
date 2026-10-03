const { execFileSync } = require('child_process');
const { readFileSync } = require('fs');

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const patterns = [
    { name: 'private key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'GitHub personal token', expression: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
    { name: 'AWS access key', expression: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'database URL with password', expression: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/i },
    { name: 'tracked environment file', expression: /.*/, file: /(^|\/)\.env(?:\.|$)/ }
];
const findings = [];
for (const file of files) {
    if (file === '.env.example') continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    for (const pattern of patterns) {
        if ((pattern.file && pattern.file.test(file)) || (!pattern.file && pattern.expression.test(content))) findings.push(`${file}: ${pattern.name}`);
    }
}
if (findings.length) {
    console.error('Secret scan failed:\n' + findings.join('\n'));
    process.exit(1);
}
console.log(`Secret scan passed for ${files.length} tracked files.`);
