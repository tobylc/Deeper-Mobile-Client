import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { globalErrorHandler, notFoundHandler, setupGracefulShutdown } from "./error-handling";
import { initializeWebSocket } from "./websocket";
import { campaignProcessor } from "./campaign-processor";

const app = express();

// Webhook endpoint needs raw body for signature verification
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// All other routes use JSON parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Trust proxy headers for accurate IP addresses behind load balancers
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Initialize WebSocket server for real-time updates
    const wsManager = initializeWebSocket(server);
    log('[WebSocket] Real-time dashboard updates enabled');

    // Start email campaign processor
    campaignProcessor.start();
    log('[EMAIL-CAMPAIGNS] Campaign processor started');

    // Setup graceful shutdown with database cleanup
    setupGracefulShutdown(server);

    // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }



  // 404 handler for unmatched API routes only (after Vite setup)
  app.use('/api/*', notFoundHandler);

  // Global error handler
  app.use(globalErrorHandler);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`Database connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
  });

  // Setup graceful shutdown
  setupGracefulShutdown(server);
  } catch (error) {
    console.error('[SERVER] Startup error:', error);
    process.exit(1);
  }
})();
