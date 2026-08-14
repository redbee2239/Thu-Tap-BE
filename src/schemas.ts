import { z } from 'zod';

const id = z.string().cuid();
const password = z.string().min(8).max(200);
const resourceName = z.string().trim().min(3).max(80);
const taskStatus = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const taskTitle = z.string({ required_error: 'Cần nhập tên công việc' }).trim().min(3, 'Tên công việc cần có ít nhất 3 ký tự').max(120);
const taskDescription = z.string({ required_error: 'Cần nhập mô tả công việc' }).trim().min(1, 'Cần nhập mô tả công việc').max(1_000);
const taskDueDate = z.string({ required_error: 'Cần nhập ngày hạn' })
  .min(1, 'Cần nhập ngày hạn')
  .date('Ngày hạn không hợp lệ')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((value) => value >= new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`), 'Ngày hạn không được ở quá khứ');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password,
  confirmPassword: password
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Mật khẩu xác nhận không khớp'
});

export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const accountUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currentPassword: password.optional(),
  newPassword: password.optional(),
  confirmPassword: password.optional()
}).superRefine((value, context) => {
  const changingPassword = value.currentPassword !== undefined || value.newPassword !== undefined || value.confirmPassword !== undefined;
  if (changingPassword) {
    if (!value.currentPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['currentPassword'], message: 'Cần nhập mật khẩu hiện tại' });
    if (!value.newPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message: 'Cần nhập mật khẩu mới' });
    if (!value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Cần xác nhận mật khẩu mới' });
    if (value.newPassword && value.confirmPassword && value.newPassword !== value.confirmPassword) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Mật khẩu xác nhận không khớp' });
    }
  }
  if (value.name === undefined && value.newPassword === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Không có dữ liệu để cập nhật' });
  }
});
export const workspaceSchema = z.object({ name: resourceName });
export const projectSchema = z.object({ name: resourceName, description: z.string().trim().max(1_000).default('') });
export const renameSchema = z.object({ name: resourceName });
export const memberSchema = z.object({ email: z.string().trim().email(), role: z.enum(['MEMBER', 'VIEWER']) });
export const taskSchema = z.object({
  title: taskTitle,
  description: taskDescription,
  status: taskStatus.default('TODO'),
  priority: z.number().int().min(1).max(5).default(3),
  dueDate: taskDueDate,
  assigneeIds: z.array(id).max(50).default([])
});
export const taskUpdateSchema = taskSchema.partial().refine((value) => Object.keys(value).length > 0, 'Không có dữ liệu để cập nhật');
export const taskQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: taskStatus.optional(),
  assigneeId: id.optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['createdAt', 'dueDate', 'priority', 'score', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc')
});
export const idParamsSchema = z.object({ id });
export const workspaceParamsSchema = z.object({ workspaceId: id });
export const projectParamsSchema = z.object({ projectId: id });
export const taskParamsSchema = z.object({ taskId: id });
