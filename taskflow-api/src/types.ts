export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  projectId: string;
}
