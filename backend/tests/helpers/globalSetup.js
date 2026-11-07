import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default async function globalSetup() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return;

  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'ignore',
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
    });
  } catch (_e) {
    // Migrations already applied or container managed
  }
}

