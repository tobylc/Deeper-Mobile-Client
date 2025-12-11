import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

// Fallback JWT-based authentication for file uploads when session fails
export const createAuthToken = (user: any): string => {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET not configured");
  }
  
  const payload = {
    id: user.claims?.sub || user.id,
    email: user.email || user.claims?.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
  };
  
  return jwt.sign(payload, process.env.SESSION_SECRET);
};

export const verifyAuthToken = (token: string): any => {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET not configured");
  }
  
  try {
    return jwt.verify(token, process.env.SESSION_SECRET);
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
};

// Enhanced authentication middleware with JWT fallback
export const enhancedAuth: RequestHandler = async (req, res, next) => {
  // Primary: Check session-based authentication
  const isSessionAuth = req.isAuthenticated && req.isAuthenticated() && req.user;
  
  if (isSessionAuth) {
    console.log("[AUTH] Session authentication successful");
    return next();
  }
  
  // Fallback: Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyAuthToken(token);
    
    if (decoded) {
      console.log("[AUTH] JWT authentication successful for user:", decoded.id);
      // Attach user info to request for downstream handlers
      (req as any).user = { 
        id: decoded.id,
        claims: { sub: decoded.id, email: decoded.email }
      };
      return next();
    }
  }
  
  console.log("[AUTH] All authentication methods failed");
  return res.status(401).json({ 
    message: "Authentication required. Please log in again.",
    code: "AUTH_REQUIRED"
  });
};