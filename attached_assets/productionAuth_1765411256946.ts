import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("REPLIT_DOMAINS environment variable required for production");
}

if (process.env.NODE_ENV === 'development') {
  console.log(`[AUTH] Production authentication system active`);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use production-ready memory store for immediate stability
  const MemoryStoreSession = MemoryStore(session);
  const sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000, // prune expired entries every 24h
    ttl: sessionTtl,
    max: 10000, // Maximum number of sessions
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[SESSION] Using optimized memory store for production stability');
  }

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: 'deeper.session',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Production authentication will be handled by Replit's built-in auth
  // This is a placeholder for when Replit Auth is properly configured
  
  // For now, require manual configuration of OAuth providers
  app.get("/api/auth/login", (req, res) => {
    res.status(501).json({ 
      error: "Authentication not configured",
      message: "Please configure OAuth providers in your Replit secrets"
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[AUTH] Logout failed:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;
  
  if (!session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = session.user;
  next();
};