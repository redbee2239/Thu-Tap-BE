export type Role = 'OWNER' | 'VIEWER';

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export type Project = {
  id: string;
  name: string;
  ownerId: string;
  workspaceId: string;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type Task = {
  id: string;
  projectId: string;
  title: string;
  priority: number;
  dueInDays: number;
  blocked: boolean;
  score: number;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  createdAt: string;
};

export type TaskUpdate = Partial<Pick<Task, 'title' | 'priority' | 'dueInDays' | 'blocked' | 'status' | 'assigneeId' | 'dueAt'>>;

export type UserRepo = {
  create(user: User): User;
  findByEmail(email: string): User | null;
  findById(id: string): User | null;
};

export type ProjectRepo = {
  create(project: Project): Project;
  findById(id: string): Project | null;
  listByWorkspace(workspaceId: string): Project[];
};

export type TaskRepo = {
  create(task: Task): Task;
  listByProject(projectId: string): Task[];
  listByProjects(projectIds: string[]): Task[];
  listDueSoon(maxDueInDays: number): Task[];
  findById(id: string): Task | null;
  update(id: string, changes: TaskUpdate): Task | null;
  delete(id: string): boolean;
};

export type Store = {
  users: UserRepo;
  projects: ProjectRepo;
  tasks: TaskRepo;
};
