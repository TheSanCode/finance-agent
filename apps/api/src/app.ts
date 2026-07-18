import express, { type Express } from "express";
import { ZodError } from "zod";
import { z } from "zod";

import {
  ApplicationError,
  UnauthorizedApplicationError
} from "../../../packages/application/src/index.js";
import { type GetCreditCardSummaryUseCase } from "../../../packages/application/src/index.js";
import { createLogger } from "../../../packages/shared/src/logger.js";
import { type Logger } from "../../../packages/shared/src/logger.js";

type AuthService = {
  verifyBearerToken: (token: string) => Promise<{ uid: string }>;
};

type AppDependencies = {
  authService: AuthService;
  getCreditCardSummaryUseCase: GetCreditCardSummaryUseCase;
  logger: Logger;
};

const routeParamsSchema = z.object({
  accountId: z.string().min(1)
});

const parseBearerToken = (headerValue: string | undefined): string => {
  if (!headerValue) {
    throw new UnauthorizedApplicationError("Missing authorization header");
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedApplicationError("Invalid authorization header");
  }

  return token;
};

export const createApp = (dependencies: AppDependencies): Express => {
  const app = express();

  const logger = dependencies.logger;

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

  app.get("/v1/credit-cards/:accountId/summary", async (req, res, next) => {
    try {
      const token = parseBearerToken(req.header("authorization"));
      const authUser = await dependencies.authService.verifyBearerToken(token);
      const params = routeParamsSchema.parse(req.params);

      const summary = await dependencies.getCreditCardSummaryUseCase.execute({
        accountId: params.accountId,
        authenticatedUserId: authUser.uid
      });

      logger.info("credit_card_summary.resolved", {
        accountId: summary.accountId,
        actorId: authUser.uid
      });

      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
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

      if (error instanceof ApplicationError) {
        const statusCode =
          error.code === "unauthorized"
            ? 401
            : error.code === "not_found"
              ? 404
              : error.code === "validation_error"
                ? 400
                : 500;

        logger.warn("request.application_error", {
          code: error.code,
          message: error.message
        });

        res.status(statusCode).json({ error: error.code, message: error.message });
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

export const createAppDependencies = (input: {
  authService: AuthService;
  getCreditCardSummaryUseCase: GetCreditCardSummaryUseCase;
  logger?: Logger;
}): AppDependencies => ({
  ...input,
  logger: input.logger ?? createLogger({ service: "finance-agent-api" })
});
