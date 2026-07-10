import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

try {
  run('npx prisma db push --accept-data-loss', path.join(root, 'packages/db'));
} catch (e) {
  console.error('prisma db push failed:', e.message);
  process.exit(1);
}

try {
  run('npx tsx seed/indian-coa.ts', path.join(root, 'packages/db'));
} catch {
  console.warn('seed skipped (may already exist)');
}

run('npx tsx src/main.ts', path.join(root, 'apps/api'));