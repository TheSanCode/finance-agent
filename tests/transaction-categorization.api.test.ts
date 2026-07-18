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
import { createLogger } from "../packages/shared/src/logger.js";

describe("transaction categorization API", () => {
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
    },
    {
      transactionId: "txn-2",
      accountId: "card-1",
      ownerUserId: "user-1",
      description: "Uber BV",
      amountMinor: 2400n,
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

  const categorizeTransactionUseCase = new CategorizeTransactionUseCase({
    transactionRepository,
    categorizationRuleRepository,
    idempotencyRepository: categorizationIdempotencyRepository,
    auditTrailRepository,
    now: () => new Date("2026-07-18T00:10:00.000Z")
  });

  const app = createApp(
    createAppDependencies({
      logger: createLogger({ service: "finance-agent-test-categorization-api" }),
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

  it("categorizes transaction deterministically", async () => {
    const response = await request(app)
      .post("/v1/transactions/txn-1/categorize")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-0001" });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("GROCERIES");
    expect(response.body.source).toBe("USER_RULE");
  });

  it("returns optional suggestion without auto-overwrite", async () => {
    const response = await request(app)
      .post("/v1/transactions/txn-2/category-suggestion")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-0002" });

    expect(response.status).toBe(200);
    expect(response.body.transactionId).toBe("txn-2");
    expect(response.body.suggestion).toBeTruthy();
  });

  it("confirms and corrects category via category-confirmation endpoint", async () => {
    const confirmResponse = await request(app)
      .post("/v1/transactions/txn-2/category-confirmation")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-0003", category: "TRANSPORTATION" });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.source).toBe("USER_CONFIRMED");

    const correctResponse = await request(app)
      .post("/v1/transactions/txn-2/category-confirmation")
      .set("authorization", "Bearer owner-token")
      .send({
        idempotencyKey: "cat-idem-0004",
        category: "FUEL",
        corrected: true,
        learnMerchantRule: true
      });

    expect(correctResponse.status).toBe(200);
    expect(correctResponse.body.source).toBe("USER_CORRECTED");
    expect(correctResponse.body.createdRuleId).toBe("rule-learned-1");
  });

  it("categorizes imported statement transactions in batch", async () => {
    const response = await request(app)
      .post("/v1/statement-imports/import-1/categorize")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-0005" });

    expect(response.status).toBe(200);
    expect(response.body.importId).toBe("import-1");
    expect(response.body.categorizedCount).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 when user tries to categorize another user's transaction", async () => {
    const response = await request(app)
      .post("/v1/transactions/txn-1/categorize")
      .set("authorization", "Bearer not-owner-token")
      .send({ idempotencyKey: "cat-idem-0006" });

    expect(response.status).toBe(404);
  });

  it("repeated bulk requests with same idempotency key produce no additional business side effects", async () => {
    const before = auditTrailRepository.records.length;

    const first = await request(app)
      .post("/v1/statement-imports/import-1/categorize")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-bulk-repeat" });

    const afterFirst = auditTrailRepository.records.length;

    const second = await request(app)
      .post("/v1/statement-imports/import-1/categorize")
      .set("authorization", "Bearer owner-token")
      .send({ idempotencyKey: "cat-idem-bulk-repeat" });

    const afterSecond = auditTrailRepository.records.length;

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(afterFirst).toBeGreaterThan(before);
    expect(afterSecond).toBe(afterFirst);
  });
});
