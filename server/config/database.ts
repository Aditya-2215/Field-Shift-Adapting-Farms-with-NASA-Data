import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.__prismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error('Database connection check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
