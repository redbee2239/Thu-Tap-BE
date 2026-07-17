import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./db.js";
import { requestIdMiddleware, RequestWithId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(requestIdMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const requestId = (req as RequestWithId).requestId;
  res.on("finish", () => {
    logger.info({ requestId, method: req.method, path: req.originalUrl, status: res.statusCode, duration: Date.now() - start });
  });
  next();
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tasks", taskRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

app.use(errorHandler);

async function main() {
  await prisma.$connect();
  logger.info("Database connected");
  app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
