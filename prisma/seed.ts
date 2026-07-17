import { PrismaClient, TaskStatus, Priority } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@test.com" },
    update: {},
    create: { email: "alice@test.com", name: "Alice", password: hash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@test.com" },
    update: {},
    create: { email: "bob@test.com", name: "Bob", password: hash },
  });

  await prisma.task.createMany({
    data: [
      { title: "Setup CI/CD", description: "Configure GitHub Actions", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, creatorId: alice.id, assigneeId: alice.id },
      { title: "Write docs", description: "API documentation", status: TaskStatus.TODO, priority: Priority.MEDIUM, creatorId: alice.id },
      { title: "Review PRs", description: "Code review for sprint", status: TaskStatus.TODO, priority: Priority.LOW, creatorId: bob.id, assigneeId: alice.id },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded: 2 users, 3 tasks");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
