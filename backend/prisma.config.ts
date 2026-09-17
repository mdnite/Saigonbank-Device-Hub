import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Render/Neon inject env vars directly; locally they come from .env.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
