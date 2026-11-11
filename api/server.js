const crypto = require("node:crypto");
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const { env, isProduction } = require("./config");
const logger = require("./logger");
const { metricsMiddleware, metricsHandler } = require("./monitoring");

const PORT = env.PORT;
const MAX_NOTE_LENGTH = 500;

function createPool() {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  });
}

function createApp(pool) {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.id = req.get("x-request-id") || crypto.randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  }));

  app.use(cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((value) => value.trim()) : false,
    credentials: true,
  }));

  app.use(compression());
  app.use(morgan(isProduction ? "combined" : "dev", {
    stream: {
      write: (message) => logger.info({ message: message.trim() }, "http access"),
    },
  }));

  app.use(express.json({ limit: "1mb" }));

  const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too_many_requests" },
  });
  app.use("/api", apiLimiter);

  if (env.ENABLE_METRICS) {
    app.use(metricsMiddleware);
  }

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ err: error }, "Health check failed");
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  if (env.ENABLE_METRICS) {
    app.get("/api/metrics", metricsHandler);
  }

  app.get("/api/notes", async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM notes ORDER BY id DESC LIMIT 50"
      );
      res.json(rows);
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch notes");
      next(error);
    }
  });

  app.post("/api/notes", async (req, res, next) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      const normalizedText = text.trim();

      if (!normalizedText) {
        return res.status(400).json({ error: "text is required" });
      }

      if (normalizedText.length > MAX_NOTE_LENGTH) {
        return res.status(400).json({
          error: `text must be ${MAX_NOTE_LENGTH} characters or fewer`,
        });
      }

      const { rows } = await pool.query(
        "INSERT INTO notes (text) VALUES ($1) RETURNING *",
        [normalizedText]
      );

      logger.info({ noteId: rows[0]?.id }, "Created note");
      return res.status(201).json(rows[0]);
    } catch (error) {
      logger.error({ err: error }, "Failed to create note");
      next(error);
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err, req, res, _next) => {
    logger.error({ err, reqId: req.id }, "Unhandled application error");

    if (err?.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    return res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

const pool = createPool();
const app = createApp(pool);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, "API listening");
  });
}

module.exports = { createApp, createPool };
