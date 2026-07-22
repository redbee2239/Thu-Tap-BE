import type { Project, ProjectRepo, Task, TaskRepo, User, UserRepo } from '../types.js';

export function createMemoryStore(): { users: UserRepo; projects: ProjectRepo; tasks: TaskRepo } {
  const users: User[] = [];
  const projects: Project[] = [];
  const tasks: Task[] = [];

  return {
    users: {
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
    },
    projects: {
      create(project) {
        projects.push(project);
        return project;
      },
      findById(id) {
        return projects.find((project) => project.id === id) || null;
      }
    },
    tasks: {
      create(task) {
        tasks.push(task);
        return task;
      },
      listByProject(projectId) {
        return tasks.filter((task) => task.projectId === projectId);
      },
      findById(id) {
        return tasks.find((task) => task.id === id) || null;
      },
      delete(id) {
        const index = tasks.findIndex((task) => task.id === id);
        if (index === -1) return false;
        tasks.splice(index, 1);
        return true;
      }
    }
  };
}