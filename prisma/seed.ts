import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/auth.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

async function main(): Promise<void> {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email || !password) {
    console.info("Skipping seed: set SEED_EMAIL and SEED_PASSWORD.");
    return;
  }
  if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: {
        name: process.env.SEED_NAME ?? "TaskFlow Admin",
        email,
        passwordHash: await hashPassword(password),
        role: 'ADMIN'
      }
    });
    const workspace = await prisma.workspace.upsert({
      where: { slug: "taskflow" },
      update: { ownerId: user.id },
      create: { name: "TaskFlow", slug: "taskflow", ownerId: user.id }
    });

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role: "OWNER" },
      create: { userId: user.id, workspaceId: workspace.id, role: "OWNER" }
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
