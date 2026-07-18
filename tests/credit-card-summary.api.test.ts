import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  ApproveStatementImportUseCase,
  CreateStatementImportPreviewUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase
} from "../packages/application/src/index.js";
import { makeMoney } from "../packages/domain/src/money.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryImportedTransactionRepository } from "../packages/infrastructure/src/in-memory-imported-transaction-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";
import { createLogger } from "../packages/shared/src/logger.js";
import { createApp, createAppDependencies } from "../apps/api/src/app.js";

describe("GET /v1/credit-cards/:accountId/summary", () => {
  const useCase = new GetCreditCardSummaryUseCase(
    new InMemoryCreditCardAccountReadRepository([
      {
        accountId: "card-1",
        ownerUserId: "user-1",
        creditLimit: makeMoney(100000n, "USD"),
        currentBalance: makeMoney(25000n, "USD")
      }
    ])
  );

  const previewRepository = new InMemoryStatementImportPreviewRepository();
  const auditTrailRepository = new InMemoryAuditTrailRepository();

  const app = createApp(
    createAppDependencies({
      logger: createLogger({ service: "finance-agent-test-api" }),
      statementMaxFileSizeBytes: 2000000,
      authService: {
        verifyBearerToken: async (token: string) => ({
          uid: token === "owner-token" ? "user-1" : "user-2"
        })
      },
      getCreditCardSummaryUseCase: useCase,
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

  it("returns 401 without bearer token", async () => {
    const response = await request(app).get("/v1/credit-cards/card-1/summary");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("returns 200 for authorized owner", async () => {
    const response = await request(app)
      .get("/v1/credit-cards/card-1/summary")
      .set("authorization", "Bearer owner-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accountId: "card-1",
      currency: "USD",
      creditLimitMinor: "100000",
      currentBalanceMinor: "25000",
      availableCreditMinor: "75000",
      utilizationBasisPoints: "2500"
    });
  });

  it("returns 404 for non-owner access", async () => {
    const response = await request(app)
      .get("/v1/credit-cards/card-1/summary")
      .set("authorization", "Bearer not-owner-token");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("not_found");
  });
});
