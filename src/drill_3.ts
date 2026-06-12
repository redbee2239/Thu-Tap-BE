export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
};

export type UserPreview = Pick<User, "id" | "name">;

// Demo
const users: User[] = [
  {
    id: "u1",
    name: "Lan",
    email: "lan@example.com",
    role: "admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "u2",
    name: "Minh",
    email: "minh@example.com",
    role: "member",
    createdAt: new Date().toISOString(),
  },
];

const previews: UserPreview[] = users.map(({ id, name }) => ({ id, name }));

console.log("=== Drill 3: UserPreview với Pick ===");
console.log("UserPreview type chỉ có id và name:");
console.log(previews);
