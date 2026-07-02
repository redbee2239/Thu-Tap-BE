import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TaskStatus } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── DRILL 1: 5 task gần hạn nhất của project, JOIN assignee ───
async function getUrgentTasks(projectId: string) {
  return prisma.task.findMany({
    where: { projectId, dueDate: { not: null } },
    orderBy: { dueDate: "asc" },
    take: 5,
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
}

// ─── DRILL 2: Transaction — tạo project + thêm owner làm member ───
async function createProjectWithOwner(workspaceId: string, name: string, ownerId: string) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { name, workspaceId } });
    await tx.membership.upsert({
      where: { userId_workspaceId: { userId: ownerId, workspaceId } },
      update: {},
      create: { userId: ownerId, workspaceId, role: "OWNER" },
    });
    return project;
  });
}

// ─── DRILL 3: Thống kê task theo project ───
async function taskStatsByProject(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } },
    },
  });
}

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case "drill1": {
      const project = await prisma.project.findFirst();
      if (!project) { console.log("No project found. Run seed first (npm run db:seed)."); break; }
      const tasks = await getUrgentTasks(project.id);
      console.log(`Top 5 urgent tasks in "${project.name}":`);
      for (const t of tasks) {
        console.log(`  [${t.priority}] ${t.title} – due ${t.dueDate?.toISOString().slice(0, 10)} – ${t.assignee?.name ?? "unassigned"}`);
      }
      break;
    }
    case "drill2": {
      const user = await prisma.user.findFirst();
      const ws = await prisma.workspace.findFirst();
      if (!user || !ws) { console.log("Run seed first."); break; }
      const project = await createProjectWithOwner(ws.id, "Drill Project", user.id);
      console.log(`Created project "${project.name}" with owner membership in a single transaction.`);
      break;
    }
    case "stats": {
      const ws = await prisma.workspace.findFirst();
      if (!ws) { console.log("Run seed first."); break; }
      const stats = await taskStatsByProject(ws.id);
      for (const p of stats) {
        const counts = { TODO: 0, IN_PROGRESS: 0, DONE: 0, CANCELLED: 0 };
        for (const t of p.tasks) counts[t.status]++;
        console.log(`"${p.name}": total=${p._count.tasks}  TODO=${counts.TODO}  IP=${counts.IN_PROGRESS}  DONE=${counts.DONE}`);
      }
      break;
    }
    default:
      console.log(`
Commands:
  drill1  → 5 urgent tasks of a project (JOIN assignee)
  drill2  → create project + owner membership (transaction)
  stats   → task stats grouped by project
      `);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
