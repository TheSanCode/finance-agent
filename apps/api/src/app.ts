import express, { type Express } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { z } from "zod";

import {
  ApplicationError,
  PayloadTooLargeApplicationError,
  UnauthorizedApplicationError,
  ValidationApplicationError
} from "../../../packages/application/src/index.js";
import {
  type ApproveStatementImportUseCase,
  type CreateStatementImportPreviewUseCase,
  type GetStatementImportPreviewUseCase
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
  createStatementImportPreviewUseCase: CreateStatementImportPreviewUseCase;
  getStatementImportPreviewUseCase: GetStatementImportPreviewUseCase;
  approveStatementImportUseCase: ApproveStatementImportUseCase;
  statementMaxFileSizeBytes: number;
  logger: Logger;
};

const routeParamsSchema = z.object({
  accountId: z.string().min(1)
});

const previewParamsSchema = z.object({
  accountId: z.string().min(1),
  previewId: z.string().min(1)
});

const approveBodySchema = z.object({
  idempotencyKey: z.string().min(8),
  approvedFingerprints: z.array(z.string().min(1)).optional()
});

const toResponsePreview = (
  preview: Awaited<ReturnType<GetStatementImportPreviewUseCase["execute"]>>
) => ({
  ...preview,
  rows: preview.rows.map((row) => ({
    rowNumber: row.rowNumber,
    occurredOn: row.occurredOn,
    description: row.description,
    fingerprint: row.fingerprint,
    amountMinor: row.amount.amountMinor.toString(),
    currency: row.amount.currency
  }))
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
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: dependencies.statementMaxFileSizeBytes
    }
  });

  const logger = dependencies.logger;

  app.use(express.json());

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-correlation-id", requestId);

    logger.info("request.received", {
      requestId,
      method: req.method,
      endpoint: "api"
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "finance-agent-api" });
  });

  app.get("/v1/credit-cards/:accountId/summary", async (req, res, next) => {
    try {
      const requestId = String(res.locals.requestId ?? "unknown");
      const token = parseBearerToken(req.header("authorization"));
      const authUser = await dependencies.authService.verifyBearerToken(token);
      const params = routeParamsSchema.parse(req.params);

      const summary = await dependencies.getCreditCardSummaryUseCase.execute({
        accountId: params.accountId,
        authenticatedUserId: authUser.uid
      });

      logger.info("credit_card_summary.resolved", {
        requestId
      });

      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/credit-cards/:accountId/statement-import-previews",
    upload.single("statement"),
    async (req, res, next) => {
      try {
        const requestId = String(res.locals.requestId ?? "unknown");
        const token = parseBearerToken(req.header("authorization"));
        const authUser = await dependencies.authService.verifyBearerToken(token);
        const params = routeParamsSchema.parse(req.params);

        if (!req.file) {
          throw new ValidationApplicationError("Statement file is required");
        }

        const preview = await dependencies.createStatementImportPreviewUseCase.execute({
          accountId: params.accountId,
          authenticatedUserId: authUser.uid,
          file: {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            content: req.file.buffer
          }
        });

        logger.info("statement_import.preview_created", {
          requestId,
          previewId: preview.previewId,
          correlationId: preview.previewId
        });

        res.status(201).json(toResponsePreview(preview));
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/v1/credit-cards/:accountId/statement-import-previews/:previewId",
    async (req, res, next) => {
      try {
        const requestId = String(res.locals.requestId ?? "unknown");
        const token = parseBearerToken(req.header("authorization"));
        const authUser = await dependencies.authService.verifyBearerToken(token);
        const params = previewParamsSchema.parse(req.params);

        const preview = await dependencies.getStatementImportPreviewUseCase.execute({
          accountId: params.accountId,
          previewId: params.previewId,
          authenticatedUserId: authUser.uid
        });

        logger.info("statement_import.preview_fetched", {
          requestId,
          previewId: params.previewId,
          correlationId: params.previewId
        });

        res.status(200).json(toResponsePreview(preview));
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/v1/credit-cards/:accountId/statement-import-previews/:previewId/approve",
    async (req, res, next) => {
      try {
        const requestId = String(res.locals.requestId ?? "unknown");
        const token = parseBearerToken(req.header("authorization"));
        const authUser = await dependencies.authService.verifyBearerToken(token);
        const params = previewParamsSchema.parse(req.params);
        const body = approveBodySchema.parse(req.body);

        const result = await dependencies.approveStatementImportUseCase.execute({
          previewId: params.previewId,
          accountId: params.accountId,
          authenticatedUserId: authUser.uid,
          idempotencyKey: body.idempotencyKey,
          approvedFingerprints: body.approvedFingerprints
        });

        logger.info("statement_import.approved", {
          requestId,
          previewId: params.previewId,
          correlationId: params.previewId,
          importedCount: result.importedCount
        });

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      const requestId = String(res.locals.requestId ?? "unknown");
      if (error instanceof ZodError) {
        logger.warn("request.validation_failed", {
          requestId,
          issues: error.issues
        });
        res.status(400).json({ error: "validation_error", details: error.issues });
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        const mapped = new PayloadTooLargeApplicationError(
          "Statement file exceeds configured maximum size"
        );
        logger.warn("request.application_error", {
          requestId,
          code: mapped.code,
          message: mapped.message
        });
        res.status(413).json({ error: mapped.code, message: mapped.message });
        return;
      }

      if (error instanceof ApplicationError) {
        const statusCode =
          error.code === "unauthorized"
            ? 401
            : error.code === "not_found"
              ? 404
              : error.code === "unsupported_media_type"
                ? 415
                : error.code === "payload_too_large"
                  ? 413
                  : error.code === "conflict"
                    ? 409
                    : error.code === "invalid_state"
                      ? 409
                      : error.code === "validation_error"
                        ? 400
                        : 500;

        logger.warn("request.application_error", {
          requestId,
          code: error.code,
          message: error.message
        });

        res.status(statusCode).json({ error: error.code, message: error.message });
        return;
      }

      logger.error("request.unhandled_error", {
        requestId,
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
  createStatementImportPreviewUseCase: CreateStatementImportPreviewUseCase;
  getStatementImportPreviewUseCase: GetStatementImportPreviewUseCase;
  approveStatementImportUseCase: ApproveStatementImportUseCase;
  statementMaxFileSizeBytes: number;
  logger?: Logger;
}): AppDependencies => ({
  ...input,
  logger: input.logger ?? createLogger({ service: "finance-agent-api" })
});
