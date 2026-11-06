import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  CLINIC_TZ: z.string().default('Asia/Kolkata'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(16).default(12),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error('\n❌ FATAL: Invalid or missing environment configuration:\n');
  console.error(issues);
  console.error('\nPlease verify your .env file matches .env.example.\n');
  process.exit(1);
}

const rawEnv = parsed.data;

export const env = Object.freeze({
  ...rawEnv,
  // Backward compatibility aliases for existing helpers
  JWT_ACCESS_EXPIRES_IN: rawEnv.JWT_ACCESS_TTL,
  JWT_REFRESH_EXPIRES_IN: rawEnv.JWT_REFRESH_TTL,
});

export default env;
