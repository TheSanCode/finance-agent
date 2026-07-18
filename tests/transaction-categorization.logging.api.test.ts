import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp, createAppDependencies } from "../apps/api/src/app.js";
import {
  ApproveStatementImportUseCase,
  CategorizeImportedStatementUseCase,
  CategorizeTransactionUseCase,
  ConfirmTransactionCategoryUseCase,
  CreateStatementImportPreviewUseCase,
  CorrectTransactionCategoryUseCase,
  GetCreditCardSummaryUseCase,
  GetStatementImportPreviewUseCase,
  SuggestTransactionCategoryUseCase
} from "../packages/application/src/index.js";
import { makeMoney } from "../packages/domain/src/money.js";
import { CsvStatementExtractor } from "../packages/infrastructure/src/csv-statement-extractor.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCategorizationIdempotencyRepository } from "../packages/infrastructure/src/in-memory-categorization-idempotency-repository.js";
import { InMemoryCategorizationRuleRepository } from "../packages/infrastructure/src/in-memory-categorization-rule-repository.js";
import { InMemoryCategorySuggestionProvider } from "../packages/infrastructure/src/in-memory-category-suggestion-provider.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { InMemoryImportedTransactionRepository } from "../packages/infrastructure/src/in-memory-imported-transaction-repository.js";
import { InMemoryPostedTransactionFingerprintReadRepository } from "../packages/infrastructure/src/in-memory-posted-transaction-fingerprint-repository.js";
import { InMemoryStatementImportPreviewRepository } from "../packages/infrastructure/src/in-memory-statement-import-preview-repository.js";
import { InMemoryTransactionRepository } from "../packages/infrastructure/src/in-memory-transaction-repository.js";

describe("transaction categorization logging", () => {
  it("does not log raw transaction or financial fields", async () => {
    const auditTrailRepository = new InMemoryAuditTrailRepository();
    const categorizationIdempotencyRepository = new InMemoryCategorizationIdempotencyRepository();
    const postedFingerprintRepository = new InMemoryPostedTransactionFingerprintReadRepository({});
    const importedTransactionRepository = new InMemoryImportedTransactionRepository(
      postedFingerprintRepository
    );
    const statementPreviewRepository = new InMemoryStatementImportPreviewRepository();
    const accountRepository = new InMemoryCreditCardAccountReadRepository([
      {
        accountId: "card-1",
        ownerUserId: "user-1",
        creditLimit: makeMoney(100000n, "USD"),
        currentBalance: makeMoney(20000n, "USD")
      }
    ]);

    const transactionRepository = new InMemoryTransactionRepository([
      {
        transactionId: "txn-1",
        accountId: "card-1",
        ownerUserId: "user-1",
        description: "Whole Foods",
        amountMinor: 9900n,
        direction: "DEBIT",
        importId: "import-1"
      }
    ]);

    const categorizationRuleRepository = new InMemoryCategorizationRuleRepository([
      {
        id: "rule-user-grocery",
        ownerUserId: "user-1",
        priority: 1,
        category: "GROCERIES",
        ruleType: "EXACT_MERCHANT",
        merchantNormalized: "whole foods",
        source: "USER"
      }
    ]);

    const logs: Array<{ event: string; payload: Record<string, unknown> }> = [];

    const logger = {
      debug: (event: string, payload: Record<string, unknown> = {}) => {
        logs.push({ event, payload });
      },
      info: (event: string, payload: Record<string, unknown> = {}) => {
        logs.push({ event, payload });
      },
      warn: (event: string, payload: Record<string, unknown> = {}) => {
        logs.push({ event, payload });
      },
      error: (event: string, payload: Record<string, unknown> = {}) => {
        logs.push({ event, payload });
      }
    };

    const categorizeTransactionUseCase = new CategorizeTransactionUseCase({
      transactionRepository,
      categorizationRuleRepository,
      idempotencyRepository: categorizationIdempotencyRepository,
      auditTrailRepository,
      now: () => new Date("2026-07-18T00:10:00.000Z")
    });

    const app = createApp(
      createAppDependencies({
        logger,
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
          previewRepository: statementPreviewRepository,
          postedFingerprintRepository,
          auditTrailRepository,
          maxFileSizeBytes: 2000000
        }),
        getStatementImportPreviewUseCase: new GetStatementImportPreviewUseCase(
          statementPreviewRepository
        ),
        approveStatementImportUseCase: new ApproveStatementImportUseCase({
          previewRepository: statementPreviewRepository,
          importedTransactionRepository,
          auditTrailRepository
        }),
        categorizeTransactionUseCase,
        suggestTransactionCategoryUseCase: new SuggestTransactionCategoryUseCase({
          transactionRepository,
          categorizationRuleRepository,
          categorySuggestionProvider: new InMemoryCategorySuggestionProvider(),
          idempotencyRepository: categorizationIdempotencyRepository,
          auditTrailRepository,
          now: () => new Date("2026-07-18T00:11:00.000Z")
        }),
        confirmTransactionCategoryUseCase: new ConfirmTransactionCategoryUseCase({
          transactionRepository,
          idempotencyRepository: categorizationIdempotencyRepository,
          auditTrailRepository,
          now: () => new Date("2026-07-18T00:12:00.000Z")
        }),
        correctTransactionCategoryUseCase: new CorrectTransactionCategoryUseCase({
          transactionRepository,
          categorizationRuleRepository,
          idempotencyRepository: categorizationIdempotencyRepository,
          auditTrailRepository,
          createId: () => "rule-learned-1",
          now: () => new Date("2026-07-18T00:13:00.000Z")
        }),
        categorizeImportedStatementUseCase: new CategorizeImportedStatementUseCase({
          transactionRepository,
          idempotencyRepository: categorizationIdempotencyRepository,
          categorizeTransactionUseCase
        })
      })
    );

    const response = await request(app)
      .post("/v1/transactions/txn-1/categorize")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "log-idem-0001" });

    expect(response.status).toBe(200);

    const categorizationLog = logs.find((entry) => entry.event === "transaction.categorized");
    expect(categorizationLog).toBeDefined();
    if (!categorizationLog) {
      throw new Error("expected transaction.categorized log");
    }

    expect(categorizationLog.payload.recordRef).toBeTypeOf("string");
    expect(categorizationLog.payload.transactionId).toBeUndefined();
    expect(categorizationLog.payload.accountId).toBeUndefined();
    expect(categorizationLog.payload.amountMinor).toBeUndefined();
    expect(categorizationLog.payload.description).toBeUndefined();
  });
});
