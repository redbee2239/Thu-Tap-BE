import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export type Database = {
  prisma: PrismaClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<void>;
};

export function createDatabase(connectionString: string): Database {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['warn', 'error']
  });

  return {
    prisma,
    connect: () => prisma.$connect(),
    disconnect: () => prisma.$disconnect(),
    async health() {
      await prisma.$queryRaw`SELECT 1`;
    }
  };
}
