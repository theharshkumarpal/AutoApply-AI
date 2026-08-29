import { PrismaClient } from '@prisma/client';

const fallbackDbUrl =
  'postgresql://postgres.vbkadnixyzsqehpdzftc:RT9bvG8YnFS-%409V@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const fallbackDirectUrl =
  'postgresql://postgres.vbkadnixyzsqehpdzftc:RT9bvG8YnFS-%409V@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = fallbackDbUrl;
}
if (!process.env.DIRECT_URL || process.env.DIRECT_URL.trim() === '') {
  process.env.DIRECT_URL = fallbackDirectUrl;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
