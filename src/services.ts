import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { hashPassword, issueTokens, verifyPassword, verifyRefreshToken, type AuthSecrets } from './auth.js';
import { type CacheStore, workspaceProjectsKey, workspaceStatsKey } from './cache.js';
import type { Database } from './db.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, BadRequestError } from './errors.js';
import type { accountUpdateSchema, memberSchema, projectSchema, registerSchema, renameSchema, taskQuerySchema, taskSchema, taskUpdateSchema, workspaceSchema } from './schemas.js';

type Role = 'OWNER' | 'MEMBER' | 'VIEWER';
type AccountRole = 'ADMIN' | 'USER';
type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';
type Logger = { info(object: unknown, message?: string): void };
type RegisterInput = z.infer<typeof registerSchema>;
type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
type WorkspaceInput = z.infer<typeof workspaceSchema>;
type ProjectInput = z.infer<typeof projectSchema>;
type RenameInput = z.infer<typeof renameSchema>;
type MemberInput = z.infer<typeof memberSchema>;
type TaskInput = z.infer<typeof taskSchema>;
type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
type TaskQuery = z.infer<typeof taskQuerySchema>;

type UserRow = { id: string; name: string; email: string; role: AccountRole; createdAt: Date };
type ProjectRow = { id: string; workspaceId: string; name: string; description: string; createdAt: Date; updatedAt: Date };
type TaskRow = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: Status;
  priority: number;
  dueDate: Date | null;
  score: number;
  assignments: Array<{ user: { id: string; name: string } }>;
  createdAt: Date;
  updatedAt: Date;
};

const readableRoles: Role[] = ['OWNER', 'MEMBER', 'VIEWER'];
const writableRoles: Role[] = ['OWNER'];

function publicUser(user: UserRow) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() };
}

function projectDto(project: ProjectRow) {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

function taskDto(task: TaskRow) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    overdue: task.status !== 'DONE' && task.dueDate !== null && task.dueDate.toISOString().slice(0, 10) <= new Date().toISOString().slice(0, 10),
    score: task.score,
    assignees: task.assignments.map((assignment) => assignment.user),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function workspaceSlug(name: string): string {
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function cursorValue(cursor: string | undefined, query: TaskQuery): { id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { id?: string; sort?: string; order?: string };
    if (typeof decoded.id !== 'string' || decoded.sort !== query.sort || decoded.order !== query.order) throw new Error();
    return { id: decoded.id };
  } catch {
    throw new BadRequestError('Cursor không hợp lệ');
  }
}

function nextCursor(task: TaskRow | undefined, query: TaskQuery): string | null {
  if (!task) return null;
  return Buffer.from(JSON.stringify({ id: task.id, sort: query.sort, order: query.order })).toString('base64url');
}

export function calculateTaskPriorityScore({ priority, dueDate }: { priority: number; dueDate: Date | null }): number {
  const dueInDays = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000) : 30;
  return priority * 10 + Math.max(0, 30 - dueInDays);
}

export function createServices(database: Database, cache: CacheStore, secrets: AuthSecrets, logger: Logger) {
  const { prisma } = database;

  async function membership(userId: string, workspaceId: string) {
    return prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
  }

  async function accountRole(userId: string): Promise<AccountRole> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new UnauthorizedError('Tài khoản không còn tồn tại');
    return user.role as AccountRole;
  }

  async function requireAdmin(userId: string): Promise<void> {
    if (await accountRole(userId) !== 'ADMIN') throw new ForbiddenError('Chỉ admin mới có thể quản lý công việc');
  }

  async function requireWorkspaceRole(userId: string, workspaceId: string, allowed: Role[]): Promise<Role> {
    const record = await membership(userId, workspaceId);
    if (!record) throw new ForbiddenError('Bạn không thuộc workspace này');
    if (!allowed.includes(record.role as Role)) throw new ForbiddenError('Bạn không có quyền thực hiện thao tác này');
    return record.role as Role;
  }

  async function projectContext(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } });
    if (!project) throw new NotFoundError('Không tìm thấy dự án');
    return project;
  }

  async function taskContext(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignments: { select: { userId: true } }, project: { include: { workspace: true } } } });
    if (!task) throw new NotFoundError('Không tìm thấy công việc');
    return task;
  }

  async function invalidateWorkspace(workspaceId: string, projects = false): Promise<void> {
    await cache.delete(workspaceStatsKey(workspaceId));
    if (projects) await cache.delete(workspaceProjectsKey(workspaceId));
  }

  async function validateAssignees(workspaceId: string, assigneeIds: string[]): Promise<string[]> {
    const ids = [...new Set(assigneeIds)];
    if (!ids.length) return ids;
    const members = await prisma.membership.findMany({
      where: { workspaceId, userId: { in: ids }, user: { role: 'USER' } },
      select: { userId: true }
    });
    if (members.length !== ids.length) throw new BadRequestError('Mỗi người được giao phải là user trong workspace này');
    return ids;
  }

  return {
    async register(input: RegisterInput) {
      const email = input.email.toLowerCase();
      if (await prisma.user.findUnique({ where: { email } })) throw new ConflictError('Email đã được đăng ký');
      const passwordHash = await hashPassword(input.password);
      const user = await prisma.user.create({ data: { name: input.name, email, passwordHash, role: 'USER' } });
      return { user: publicUser(user), ...issueTokens(user.id, secrets) };
    },

    async login(email: string, password: string) {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !(await verifyPassword(password, user.passwordHash))) throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
      return { user: publicUser(user), ...issueTokens(user.id, secrets) };
    },

    async refresh(refreshToken: string) {
      const payload = verifyRefreshToken(refreshToken, secrets);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedError('Tài khoản không còn tồn tại');
      return { user: publicUser(user), ...issueTokens(user.id, secrets) };
    },

    async me(userId: string) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedError('Tài khoản không còn tồn tại');
      return publicUser(user);
    },

    async updateMe(userId: string, input: AccountUpdateInput) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedError('Tài khoản không còn tồn tại');
      if (input.newPassword !== undefined && (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash)))) {
        throw new ForbiddenError('Mật khẩu hiện tại không đúng');
      }
      const passwordHash = input.newPassword === undefined ? undefined : await hashPassword(input.newPassword);
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(passwordHash === undefined ? {} : { passwordHash })
        }
      });
      return publicUser(updated);
    },

    async listWorkspaces(userId: string) {
      const workspaces = await prisma.workspace.findMany({
        where: { memberships: { some: { userId } } },
        include: { memberships: { where: { userId }, select: { role: true } } },
        orderBy: { createdAt: 'asc' }
      });
      return workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspace.memberships[0]?.role ?? 'VIEWER',
        createdAt: workspace.createdAt.toISOString()
      }));
    },

    async createWorkspace(userId: string, input: WorkspaceInput) {
      await requireAdmin(userId);
      const workspace = await prisma.$transaction(async (tx) => {
        const created = await tx.workspace.create({ data: { name: input.name, slug: workspaceSlug(input.name), ownerId: userId } });
        await tx.membership.create({ data: { userId, workspaceId: created.id, role: 'OWNER' } });
        await tx.project.create({ data: { name: 'Việc của tôi', workspaceId: created.id } });
        return created;
      });
      return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER', createdAt: workspace.createdAt.toISOString() };
    },

    async addMember(userId: string, workspaceId: string, input: MemberInput) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, ['OWNER']);
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!user) throw new NotFoundError('Không tìm thấy người dùng theo email');
      if (await membership(user.id, workspaceId)) throw new ConflictError('Người dùng đã thuộc workspace này');
      const member = await prisma.membership.create({ data: { userId: user.id, workspaceId, role: input.role } });
      return { userId: member.userId, workspaceId: member.workspaceId, role: member.role };
    },

    async listMembers(userId: string, workspaceId: string) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, ['OWNER']);
      const members = await prisma.membership.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      });
      return members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
        workspaceRole: member.role
      }));
    },

    async deleteWorkspace(userId: string, workspaceId: string) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, ['OWNER']);
      await prisma.workspace.delete({ where: { id: workspaceId } });
      await invalidateWorkspace(workspaceId, true);
    },

    async updateWorkspace(userId: string, workspaceId: string, input: RenameInput) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, ['OWNER']);
      const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data: { name: input.name } });
      return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER', createdAt: workspace.createdAt.toISOString() };
    },

    async listProjects(userId: string, workspaceId: string) {
      await requireWorkspaceRole(userId, workspaceId, readableRoles);
      const key = workspaceProjectsKey(workspaceId);
      const cached = await cache.get(key);
      if (cached) {
        try {
          logger.info({ workspaceId, cache: 'hit' }, 'Project cache hit');
          return JSON.parse(cached);
        } catch {
          await cache.delete(key);
        }
      }
      logger.info({ workspaceId, cache: 'miss' }, 'Project cache miss');
      const projects = await prisma.project.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
      const result = projects.map(projectDto);
      await cache.set(key, JSON.stringify(result), 60);
      return result;
    },

    async createProject(userId: string, workspaceId: string, input: ProjectInput) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, writableRoles);
      const project = await prisma.project.create({ data: { workspaceId, name: input.name, description: input.description } });
      await invalidateWorkspace(workspaceId, true);
      return projectDto(project);
    },

    async deleteProject(userId: string, projectId: string) {
      const project = await projectContext(projectId);
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, project.workspaceId, writableRoles);
      await prisma.project.delete({ where: { id: projectId } });
      await invalidateWorkspace(project.workspaceId, true);
    },

    async updateProject(userId: string, projectId: string, input: RenameInput) {
      const project = await projectContext(projectId);
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, project.workspaceId, writableRoles);
      const updated = await prisma.project.update({ where: { id: projectId }, data: { name: input.name } });
      await invalidateWorkspace(project.workspaceId, true);
      return projectDto(updated);
    },

    async listTasks(userId: string, projectId: string, query: TaskQuery) {
      const project = await projectContext(projectId);
      await requireWorkspaceRole(userId, project.workspaceId, readableRoles);
      const role = await accountRole(userId);
      const cursor = cursorValue(query.cursor, query);
      const rows = await prisma.task.findMany({
        where: {
          projectId,
          ...(query.status ? { status: query.status } : { status: { not: 'DONE' } }),
          ...(role === 'USER' ? { assignments: { some: { userId } } } : query.assigneeId ? { assignments: { some: { userId: query.assigneeId } } } : {}),
          ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {})
        },
        include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
        orderBy: [{ [query.sort]: query.order }, { id: query.order }] as never,
        ...(cursor ? { cursor, skip: 1 } : {}),
        take: query.limit + 1
      });
      const hasNextPage = rows.length > query.limit;
      const items = hasNextPage ? rows.slice(0, query.limit) : rows;
      return {
        items: items.map(taskDto),
        pagination: {
          limit: query.limit,
          sort: query.sort,
          order: query.order,
          hasNextPage,
          nextCursor: hasNextPage ? nextCursor(items.at(-1), query) : null
        }
      };
    },

    async createTask(userId: string, projectId: string, input: TaskInput) {
      const project = await projectContext(projectId);
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, project.workspaceId, writableRoles);
      const assigneeIds = await validateAssignees(project.workspaceId, input.assigneeIds);
      const task = await prisma.task.create({
        data: {
          projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate,
          assignments: { create: assigneeIds.map((userId) => ({ userId })) },
          score: calculateTaskPriorityScore(input)
        },
        include: { assignments: { include: { user: { select: { id: true, name: true } } } } }
      });
      await invalidateWorkspace(project.workspaceId);
      return taskDto(task);
    },

    async updateTask(userId: string, taskId: string, input: TaskUpdateInput) {
      const task = await taskContext(taskId);
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, task.project.workspaceId, writableRoles);
      const assigneeIds = input.assigneeIds === undefined ? undefined : await validateAssignees(task.project.workspaceId, input.assigneeIds);
      const next = {
        priority: input.priority ?? task.priority,
        dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate
      };
      const updated = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: taskId },
          data: {
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.priority === undefined ? {} : { priority: input.priority }),
            ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
            ...(assigneeIds === undefined ? {} : { assignments: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) } }),
            score: calculateTaskPriorityScore(next)
          },
          include: { assignments: { include: { user: { select: { id: true, name: true } } } } }
        });
        if (input.status === 'DONE' && task.status !== 'DONE') {
          await tx.taskCompletion.create({ data: { taskId, confirmedById: userId } });
        }
        return updatedTask;
      });
      await invalidateWorkspace(task.project.workspaceId);
      return taskDto(updated);
    },

    async completeTask(userId: string, taskId: string) {
      const task = await taskContext(taskId);
      if (await accountRole(userId) === 'ADMIN') {
        await requireWorkspaceRole(userId, task.project.workspaceId, writableRoles);
      } else {
        await requireWorkspaceRole(userId, task.project.workspaceId, readableRoles);
        if (!task.assignments.some((assignment) => assignment.userId === userId)) throw new ForbiddenError('Bạn chỉ có thể xác nhận task được giao cho mình');
      }
      const completion = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.updateMany({ where: { id: taskId, status: { not: 'DONE' } }, data: { status: 'DONE' } });
        if (!updated.count) return null;
        return tx.taskCompletion.create({
          data: { taskId, confirmedById: userId },
          include: { confirmedBy: { select: { id: true, name: true, email: true } } }
        });
      });
      await invalidateWorkspace(task.project.workspaceId);
      return completion ? {
        completion: {
          id: completion.id,
          completedAt: completion.completedAt.toISOString(),
          confirmedBy: completion.confirmedBy
        }
      } : { completion: null };
    },

    async deleteTask(userId: string, taskId: string) {
      const task = await taskContext(taskId);
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, task.project.workspaceId, writableRoles);
      await prisma.task.delete({ where: { id: taskId } });
      await invalidateWorkspace(task.project.workspaceId);
    },

    async listCompletions(userId: string, workspaceId: string) {
      await requireAdmin(userId);
      await requireWorkspaceRole(userId, workspaceId, writableRoles);
      const completions = await prisma.taskCompletion.findMany({
        where: { task: { project: { workspaceId } } },
        include: {
          task: { select: { id: true, title: true, project: { select: { name: true } } } },
          confirmedBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { completedAt: 'desc' },
        take: 100
      });
      return completions.map((completion) => ({
        id: completion.id,
        completedAt: completion.completedAt.toISOString(),
        task: { id: completion.task.id, title: completion.task.title, projectName: completion.task.project.name },
        confirmedBy: completion.confirmedBy
      }));
    },

    async workspaceStats(userId: string, workspaceId: string) {
      await requireWorkspaceRole(userId, workspaceId, readableRoles);
      const role = await accountRole(userId);
      const key = role === 'ADMIN' ? workspaceStatsKey(workspaceId) : null;
      const cached = key ? await cache.get(key) : null;
      if (cached) {
        try {
          logger.info({ workspaceId, cache: 'hit' }, 'Stats cache hit');
          return JSON.parse(cached);
        } catch {
          if (key) await cache.delete(key);
        }
      }
      logger.info({ workspaceId, cache: 'miss' }, 'Stats cache miss');
      const tasks = await prisma.task.findMany({
        where: { project: { workspaceId }, ...(role === 'USER' ? { assignments: { some: { userId } } } : {}) },
        select: { status: true, dueDate: true }
      });
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const stats = { total: tasks.length, todo: 0, inProgress: 0, done: 0, dueSoon: 0 };
      for (const task of tasks) {
        if (task.status === 'TODO') stats.todo += 1;
        if (task.status === 'IN_PROGRESS') stats.inProgress += 1;
        if (task.status === 'DONE') stats.done += 1;
        if (task.status !== 'DONE' && task.dueDate && task.dueDate <= tomorrow) stats.dueSoon += 1;
      }
      if (key) await cache.set(key, JSON.stringify(stats), 60);
      return stats;
    },

    async dueSoon() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return prisma.task.findMany({
        where: { status: { not: 'DONE' }, dueDate: { not: null, lte: tomorrow } },
        select: { id: true, title: true, dueDate: true, project: { select: { workspaceId: true } } },
        orderBy: { dueDate: 'asc' }
      });
    }
  };
}
