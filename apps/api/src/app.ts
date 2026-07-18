import express, { type Express } from "express";
import { ZodError } from "zod";

import { createLogger } from "../../../packages/shared/src/logger.js";

const logger = createLogger({ service: "finance-agent-api" });

export const createApp = (): Express => {
  const app = express();

  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info("request.received", {
      method: req.method,
      path: req.path
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "finance-agent-api" });
  });

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      if (error instanceof ZodError) {
        logger.warn("request.validation_failed", {
          issues: error.issues
        });
        res.status(400).json({ error: "validation_error", details: error.issues });
        return;
      }

      logger.error("request.unhandled_error", {
        error: error instanceof Error ? error.message : "unknown"
      });
      res.status(500).json({ error: "internal_error" });
    }
  );

  return app;
};
