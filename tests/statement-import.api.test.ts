import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp, createAppDependencies } from "../apps/api/src/app.js";
import {
  ApproveStatementImportUseCase,
  CreateStatementImportPreviewUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase
} from "../packages/application/src/index.js";
import { makeMoney } from "../packages/domain/src/money.js";
import { CsvStatementExtractor } from "../packages/infrastructure/src/csv-statement-extractor.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryImportedTransactionRepository } from "../packages/infrastructure/src/in-memory-imported-transaction-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";
import { createLogger } from "../packages/shared/src/logger.js";

describe("statement import API", () => {
  const previewRepository = new InMemoryStatementImportPreviewRepository();
  const importedRepository = new InMemoryImportedTransactionRepository();
  const auditTrailRepository = new InMemoryAuditTrailRepository();
  const accountRepository = new InMemoryCreditCardAccountReadRepository([
    {
      accountId: "card-1",
      ownerUserId: "user-1",
      creditLimit: makeMoney(100000n, "USD"),
      currentBalance: makeMoney(20000n, "USD")
    }
  ]);

  const app = createApp(
    createAppDependencies({
      logger: createLogger({ service: "finance-agent-test-statement-api" }),
      statementMaxFileSizeBytes: 2000000,
      authService: {
        verifyBearerToken: async (token: string) => ({
          uid: token === "owner-token" ? "user-1" : "user-2"
        })
      },
      getCreditCardSummaryUseCase: new GetCreditCardSummaryUseCase(accountRepository),
      createStatementImportPreviewUseCase: new CreateStatementImportPreviewUseCase({
        accountReadRepository: accountRepository,
        statementExtractor: new CsvStatementExtractor(),
        previewRepository,
        postedFingerprintRepository: new InMemoryPostedTransactionFingerprintReadRepository({}),
        auditTrailRepository,
        maxFileSizeBytes: 2000000,
        createId: () => "preview-api-1",
        now: () => new Date("2026-07-18T00:00:00.000Z")
      }),
      getStatementImportPreviewUseCase: new GetStatementImportPreviewUseCase(previewRepository),
      approveStatementImportUseCase: new ApproveStatementImportUseCase({
        previewRepository,
        importedTransactionRepository: importedRepository,
        auditTrailRepository,
        now: () => new Date("2026-07-18T00:00:10.000Z")
      })
    })
  );

  it("creates preview and approves import with idempotency", async () => {
    const csv = [
      "date,description,amountMinor,currency,statementTotalMinor",
      "2026-07-01,Coffee Shop,455,USD,1510",
      "2026-07-02,Book Store,1055,USD,1510"
    ].join("\n");

    const createResponse = await request(app)
      .post("/v1/credit-cards/card-1/statement-import-previews")
      .set("authorization", "Bearer owner-token")
      .attach("statement", Buffer.from(csv, "utf-8"), {
        filename: "statement.csv",
        contentType: "text/csv"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe("PENDING_APPROVAL");

    const getResponse = await request(app)
      .get("/v1/credit-cards/card-1/statement-import-previews/preview-api-1")
      .set("authorization", "Bearer owner-token");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.previewId).toBe("preview-api-1");

    const approveFirst = await request(app)
      .post("/v1/credit-cards/card-1/statement-import-previews/preview-api-1/approve")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "api-idem-0001" });

    const approveSecond = await request(app)
      .post("/v1/credit-cards/card-1/statement-import-previews/preview-api-1/approve")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "api-idem-0001" });

    expect(approveFirst.status).toBe(200);
    expect(approveFirst.body.status).toBe("IMPORTED");
    expect(approveFirst.body.importedCount).toBe(2);
    expect(approveSecond.status).toBe(200);
    expect(approveSecond.body.importedCount).toBe(2);
  });

  it("returns 404 for non-owner preview access", async () => {
    const response = await request(app)
      .get("/v1/credit-cards/card-1/statement-import-previews/preview-api-1")
      .set("authorization", "Bearer not-owner-token");

    expect(response.status).toBe(404);
  });
});
