import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Todo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
};

type Command =
  | { name: "add"; title: string }
  | { name: "list" }
  | { name: "done"; id: number }
  | { name: "remove"; id: number };

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const todoFilePath = resolve(projectRoot, "data", "todos.json");

async function readTodos(): Promise<Todo[]> {
  try {
    const content = await readFile(todoFilePath, "utf8");
    return parseTodos(JSON.parse(content) as unknown);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeTodos(todos: readonly Todo[]): Promise<void> {
  await mkdir(dirname(todoFilePath), { recursive: true });
  await writeFile(todoFilePath, `${JSON.stringify(todos, null, 2)}\n`, "utf8");
}

function parseTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) {
    throw new Error("todos.json must contain an array");
  }

  const todos: Todo[] = [];

  for (const item of value) {
    todos.push(parseTodo(item));
  }

  return todos;
}

function parseTodo(value: unknown): Todo {
  if (!isRecord(value)) {
    throw new Error("todo item must be an object");
  }

  const { id, title, done, createdAt } = value;

  if (typeof id !== "number" || !Number.isInteger(id)) {
    throw new Error("todo.id must be an integer");
  }
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("todo.title must be a non-empty string");
  }
  if (typeof done !== "boolean") {
    throw new Error("todo.done must be a boolean");
  }
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    throw new Error("todo.createdAt must be an ISO date string");
  }

  return { id, title, done, createdAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseCommand(args: readonly string[]): Command {
  const [command, ...rest] = args;

  switch (command) {
    case "add": {
      const title = rest.join(" ").trim();
      if (title === "") {
        throw new Error("Usage: todo add <title>");
      }
      return { name: "add", title };
    }
    case "list":
      return { name: "list" };
    case "done":
      return { name: "done", id: parseId(rest[0], "done") };
    case "remove":
      return { name: "remove", id: parseId(rest[0], "remove") };
    default:
      throw new Error("Usage: todo <add|list|done|remove>");
  }
}

function parseId(value: string | undefined, command: "done" | "remove"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Usage: todo ${command} <id>`);
  }
  return id;
}

function nextId(todos: readonly Todo[]): number {
  return todos.reduce((maxId, todo) => Math.max(maxId, todo.id), 0) + 1;
}

function formatTodo(todo: Todo): string {
  const marker = todo.done ? "x" : " ";
  return `${todo.id}. [${marker}] ${todo.title} (${todo.createdAt})`;
}

async function handleCommand(command: Command): Promise<void> {
  const todos = await readTodos();

  switch (command.name) {
    case "add": {
      const todo: Todo = {
        id: nextId(todos),
        title: command.title,
        done: false,
        createdAt: new Date().toISOString()
      };
      await writeTodos([...todos, todo]);
      console.log(`Added #${todo.id}: ${todo.title}`);
      return;
    }
    case "list": {
      if (todos.length === 0) {
        console.log("No todos yet.");
        return;
      }
      console.log(todos.map(formatTodo).join("\n"));
      return;
    }
    case "done": {
      const index = todos.findIndex((todo) => todo.id === command.id);
      if (index === -1) {
        throw new Error(`Todo #${command.id} not found`);
      }

      const updatedTodos = [...todos];
      updatedTodos[index] = { ...updatedTodos[index], done: true };

      await writeTodos(updatedTodos);
      console.log(`Done #${command.id}`);
      return;
    }
    case "remove": {
      const updatedTodos = todos.filter((todo) => todo.id !== command.id);
      if (updatedTodos.length === todos.length) {
        throw new Error(`Todo #${command.id} not found`);
      }
      await writeTodos(updatedTodos);
      console.log(`Removed #${command.id}`);
      return;
    }
  }
}

async function main(): Promise<void> {
  try {
    await handleCommand(parseCommand(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    process.exitCode = 1;
  }
}

await main();
