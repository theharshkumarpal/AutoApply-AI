import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres.vbkadnixyzsqehpdzftc:RT9bvG8YnFS-%409V@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
