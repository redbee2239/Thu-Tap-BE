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
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  priority: number;
  dueInDays: number;
  blocked: boolean;
  score: number;
};

export type UserRepo = {
  create(user: User): User;
  findByEmail(email: string): User | null;
  findById(id: string): User | null;
};

export type ProjectRepo = {
  create(project: Project): Project;
  findById(id: string): Project | null;
};

export type TaskRepo = {
  create(task: Task): Task;
  listByProject(projectId: string): Task[];
  findById(id: string): Task | null;
  delete(id: string): boolean;
};