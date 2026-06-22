import { User, Workspace, Project, Task } from './types';

const users: User[] = [];
const workspaces: Workspace[] = [];
const projects: Project[] = [];
const tasks: Task[] = [];

export const db = {
  users: {
    findAll: () => users,
    findByEmail: (email: string) => users.find((u) => u.email === email),
    create: (u: User) => { users.push(u); return u; },
  },
  workspaces: {
    findAll: () => workspaces,
    findById: (id: string) => workspaces.find((w) => w.id === id),
    create: (w: Workspace) => { workspaces.push(w); return w; },
    update: (id: string, data: Partial<Workspace>) => {
      const w = workspaces.find((x) => x.id === id);
      if (w) Object.assign(w, data);
      return w;
    },
    delete: (id: string) => {
      const i = workspaces.findIndex((x) => x.id === id);
      if (i >= 0) workspaces.splice(i, 1);
      return i >= 0;
    },
  },
  projects: {
    findAll: () => projects,
    findById: (id: string) => projects.find((p) => p.id === id),
    findByWorkspace: (wsId: string) => projects.filter((p) => p.workspaceId === wsId),
    create: (p: Project) => { projects.push(p); return p; },
    update: (id: string, data: Partial<Project>) => {
      const p = projects.find((x) => x.id === id);
      if (p) Object.assign(p, data);
      return p;
    },
    delete: (id: string) => {
      const i = projects.findIndex((x) => x.id === id);
      if (i >= 0) projects.splice(i, 1);
      return i >= 0;
    },
  },
  tasks: {
    findAll: () => tasks,
    findById: (id: string) => tasks.find((t) => t.id === id),
    findByProject: (pId: string) => tasks.filter((t) => t.projectId === pId),
    create: (t: Task) => { tasks.push(t); return t; },
    update: (id: string, data: Partial<Task>) => {
      const t = tasks.find((x) => x.id === id);
      if (t) Object.assign(t, data);
      return t;
    },
    delete: (id: string) => {
      const i = tasks.findIndex((x) => x.id === id);
      if (i >= 0) tasks.splice(i, 1);
      return i >= 0;
    },
  },
};
