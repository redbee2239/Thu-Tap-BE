import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { TaskStatus, Priority } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { NotFoundError } from "../errors.js";

const router = Router();
router.use(requireAuth);

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).default(""),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().uuid().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

const querySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().uuid().optional(),
});

router.get("/", validate(querySchema, "query"), async (req, res) => {
  const q = (req as unknown as { _validatedQuery: { status?: TaskStatus; assigneeId?: string } })._validatedQuery;
  const where: Record<string, unknown> = {};
  if (q?.status) where.status = q.status;
  if (q?.assigneeId) where.assigneeId = q.assigneeId;
  const tasks = await prisma.task.findMany({ where, include: { creator: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  res.json({ tasks });
});

router.get("/:id", async (req, res, next) => {
  const id = req.params.id as string;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } } },
  });
  if (!task) {
    next(new NotFoundError("Task", id));
    return;
  }
  res.json({ task });
});

router.post("/", validate(createTaskSchema), async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const task = await prisma.task.create({
    data: { ...req.body, creatorId: user.id },
    include: { creator: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json({ task });
});

router.patch("/:id", validate(updateTaskSchema), async (req, res, next) => {
  const id = req.params.id as string;
  try {
    const task = await prisma.task.update({
      where: { id },
      data: req.body,
      include: { creator: { select: { id: true, name: true, email: true } }, assignee: { select: { id: true, name: true, email: true } } },
    });
    res.json({ task });
  } catch {
    next(new NotFoundError("Task", id));
  }
});

router.delete("/:id", async (req, res, next) => {
  const id = req.params.id as string;
  try {
    await prisma.task.delete({ where: { id } });
    res.status(204).end();
  } catch {
    next(new NotFoundError("Task", id));
  }
});

export default router;
