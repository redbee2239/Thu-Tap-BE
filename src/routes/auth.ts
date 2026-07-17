import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { validate } from "../middleware/validate.js";
import { AuthError, ConflictError } from "../errors.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, name, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      next(new ConflictError("Email already registered"));
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user.id }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    res.status(201).json({ user: { id: user.id, email, name, role: user.role }, token, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      next(new AuthError("Invalid email or password"));
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user.id }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    res.json({ user: { id: user.id, email, name: user.name, role: user.role }, token, refreshToken });
  } catch (err) {
    next(err);
  }
});

export default router;
