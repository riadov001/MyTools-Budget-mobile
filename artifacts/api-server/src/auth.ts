import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { type User } from "@shared/schema";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export const JWT_SECRET = process.env.JWT_SECRET || "super_secret_fallback_key_for_development";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign({ id: user.id, role: user.role, applicationId: user.applicationId }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role hierarchy: ROOT_ADMIN > SUPER_ADMIN > ADMIN > USER
export const ROLE_HIERARCHY = ["USER", "ADMIN", "SUPER_ADMIN", "ROOT_ADMIN"];

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(403).json({ message: "Forbidden" });
    // ROOT_ADMIN bypasses all role checks — it is a superset of every role
    if (req.user.role === "ROOT_ADMIN" || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  };
};
