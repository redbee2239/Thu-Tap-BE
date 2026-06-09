type Key = string | number | symbol;

export function groupBy<T>(items: readonly T[], keyFn: (item: T) => Key): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of items) {
    const key = String(keyFn(item));

    if (groups[key] === undefined) {
      groups[key] = [];
    }

    groups[key].push(item);
  }

  return groups;
}

export async function retry<T>(fn: () => Promise<T>, times: number): Promise<T> {
  if (!Number.isInteger(times) || times < 1) {
    throw new Error("times must be a positive integer");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= times; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("retry failed");
}

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
};

export type UserPreview = Pick<User, "id" | "name">;

const users: User[] = [
  {
    id: "u1",
    name: "Lan",
    email: "lan@example.com",
    role: "admin",
    createdAt: new Date().toISOString()
  },
  {
    id: "u2",
    name: "Minh",
    email: "minh@example.com",
    role: "member",
    createdAt: new Date().toISOString()
  }
];

const groupedUsers = groupBy(users, (user) => user.role);
const previews: UserPreview[] = users.map(({ id, name }) => ({ id, name }));

console.log("Grouped users:", groupedUsers);
console.log("User previews:", previews);
