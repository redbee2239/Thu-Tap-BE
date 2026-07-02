import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, TaskStatus, Priority } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  await prisma.task.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const alice = await prisma.user.create({
    data: { email: "alice@example.com", passwordHash: "hash_alice", name: "Alice Nguyen" },
  });
  const bob = await prisma.user.create({
    data: { email: "bob@example.com", passwordHash: "hash_bob", name: "Bob Tran" },
  });
  const charlie = await prisma.user.create({
    data: { email: "charlie@example.com", passwordHash: "hash_charlie", name: "Charlie Le" },
  });

  const workspace = await prisma.workspace.create({
    data: { name: "Capstone Project", ownerId: alice.id },
  });

  await prisma.membership.createMany({
    data: [
      { userId: alice.id, workspaceId: workspace.id, role: Role.OWNER },
      { userId: bob.id, workspaceId: workspace.id, role: Role.MEMBER },
      { userId: charlie.id, workspaceId: workspace.id, role: Role.MEMBER },
    ],
  });

  const project1 = await prisma.project.create({
    data: { name: "Backend API", workspaceId: workspace.id },
  });
  const project2 = await prisma.project.create({
    data: { name: "Frontend App", workspaceId: workspace.id },
  });

  await prisma.task.createMany({
    data: [
      { title: "Thiết kế database schema", status: TaskStatus.DONE, priority: Priority.HIGH, dueDate: new Date("2026-07-05"), projectId: project1.id, assigneeId: alice.id },
      { title: "Viết API CRUD cho User", status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, dueDate: new Date("2026-07-08"), projectId: project1.id, assigneeId: bob.id },
      { title: "Xác thực JWT", status: TaskStatus.TODO, priority: Priority.URGENT, dueDate: new Date("2026-07-03"), projectId: project1.id, assigneeId: alice.id },
      { title: "Tạo giao diện Login", status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, dueDate: new Date("2026-07-06"), projectId: project2.id, assigneeId: charlie.id },
      { title: "Dashboard tổng quan", status: TaskStatus.TODO, priority: Priority.LOW, dueDate: new Date("2026-07-12"), projectId: project2.id, assigneeId: null },
      { title: "Kiểm thử API", status: TaskStatus.TODO, priority: Priority.MEDIUM, dueDate: new Date("2026-07-10"), projectId: project1.id, assigneeId: bob.id },
      { title: "Viết Dockerfile", status: TaskStatus.TODO, priority: Priority.LOW, dueDate: new Date("2026-07-15"), projectId: project1.id, assigneeId: null },
    ],
  });

  console.log("Seed completed!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
