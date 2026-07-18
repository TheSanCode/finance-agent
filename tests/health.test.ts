import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp, createAppDependencies } from "../apps/api/src/app.js";
import {
  ApproveStatementImportUseCase,
  CreateStatementImportPreviewUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase
} from "../packages/application/src/index.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryImportedTransactionRepository } from "../packages/infrastructure/src/in-memory-imported-transaction-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";
import { createLogger } from "../packages/shared/src/logger.js";

describe("health endpoint", () => {
  it("returns status ok", async () => {
    const previewRepository = new InMemoryStatementImportPreviewRepository();
    const auditTrailRepository = new InMemoryAuditTrailRepository();

    const app = createApp(
      createAppDependencies({
        logger: createLogger({ service: "finance-agent-test-health" }),
        statementMaxFileSizeBytes: 2000000,
        authService: {
          verifyBearerToken: async () => ({ uid: "user-1" })
        },
        getCreditCardSummaryUseCase: new GetCreditCardSummaryUseCase(
          new InMemoryCreditCardAccountReadRepository([])
        ),
        createStatementImportPreviewUseCase: new CreateStatementImportPreviewUseCase({
          accountReadRepository: new InMemoryCreditCardAccountReadRepository([]),
          statementExtractor: {
            extract: async () => ({ rows: [] })
          },
          previewRepository,
          postedFingerprintRepository: new InMemoryPostedTransactionFingerprintReadRepository({}),
          auditTrailRepository,
          maxFileSizeBytes: 2000000
        }),
        getStatementImportPreviewUseCase: new GetStatementImportPreviewUseCase(previewRepository),
        approveStatementImportUseCase: new ApproveStatementImportUseCase({
          previewRepository,
          importedTransactionRepository: new InMemoryImportedTransactionRepository(),
          auditTrailRepository
        })
      })
    );

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "finance-agent-api" });
  });
});
