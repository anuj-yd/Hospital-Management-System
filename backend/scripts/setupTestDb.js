import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://hms_user:hms_password@localhost:5432/hms_test?schema=public';

console.log(`🚀 Setting up test database: ${testDbUrl.replace(/:[^:@]*@/, ':****@')}`);

try {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
  });
  console.log('✅ Test database schema deployed successfully.');
} catch (error) {
  console.error('❌ Failed to deploy test database schema:', error.message);
  process.exit(1);
}

