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

// Demo
type User = {
  id: string;
  name: string;
  role: "admin" | "member";
};

const users: User[] = [
  { id: "u1", name: "Lan", role: "admin" },
  { id: "u2", name: "Minh", role: "member" },
  { id: "u3", name: "An", role: "admin" },
];

const grouped = groupBy(users, (u) => u.role);
console.log("=== Drill 1: groupBy ===");
console.log(JSON.stringify(grouped, null, 2));
