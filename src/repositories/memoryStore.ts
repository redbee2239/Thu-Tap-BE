import type { Project, ProjectRepo, Store, Task, TaskRepo, TaskUpdate, User, UserRepo } from '../types.js';

export function createMemoryStore(): Store {
  const users: User[] = [];
  const projects: Project[] = [];
  const tasks: Task[] = [];

  const userRepo: UserRepo = {
    create(user) {
      users.push(user);
      return user;
    },
    findByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    findById(id) {
      return users.find((user) => user.id === id) || null;
    }
  };

  const projectRepo: ProjectRepo = {
    create(project) {
      projects.push(project);
      return project;
    },
    findById(id) {
      return projects.find((project) => project.id === id) || null;
    },
    listByWorkspace(workspaceId) {
      return projects.filter((project) => project.workspaceId === workspaceId);
    }
  };

  const taskRepo: TaskRepo = {
    create(task) {
      tasks.push(task);
      return task;
    },
    listByProject(projectId) {
      return tasks.filter((task) => task.projectId === projectId);
    },
    listByProjects(projectIds) {
      const ids = new Set(projectIds);
      return tasks.filter((task) => ids.has(task.projectId));
    },
    listDueSoon(maxDueInDays) {
      return tasks.filter((task) => task.status !== 'DONE' && task.dueInDays <= maxDueInDays);
    },
    findById(id) {
      return tasks.find((task) => task.id === id) || null;
    },
    update(id, changes: TaskUpdate) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return null;
      Object.assign(task, changes);
      return task;
    },
    delete(id) {
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) return false;
      tasks.splice(index, 1);
      return true;
    }
  };

  return { users: userRepo, projects: projectRepo, tasks: taskRepo };
}
