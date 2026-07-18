import { describe, expect, it } from "vitest";

import { SuggestTransactionCategoryUseCase } from "../packages/application/src/suggest-transaction-category.js";
import { InMemoryAuditTrailRepository } from "../packages/infrastructure/src/in-memory-audit-trail-repository.js";
import { InMemoryCategorizationIdempotencyRepository } from "../packages/infrastructure/src/in-memory-categorization-idempotency-repository.js";
import { InMemoryCategorizationRuleRepository } from "../packages/infrastructure/src/in-memory-categorization-rule-repository.js";
import { InMemoryTransactionRepository } from "../packages/infrastructure/src/in-memory-transaction-repository.js";

describe("suggest transaction category use case", () => {
  it("evaluates deterministic rules first and skips AI provider when a rule matches", async () => {
    let providerCalls = 0;

    const useCase = new SuggestTransactionCategoryUseCase({
      transactionRepository: new InMemoryTransactionRepository([
        {
          transactionId: "txn-1",
          accountId: "card-1",
          ownerUserId: "user-1",
          description: "Whole Foods",
          amountMinor: 7500n,
          direction: "DEBIT"
        }
      ]),
      categorizationRuleRepository: new InMemoryCategorizationRuleRepository([
        {
          id: "rule-1",
          ownerUserId: "user-1",
          priority: 1,
          category: "GROCERIES",
          ruleType: "EXACT_MERCHANT",
          merchantNormalized: "whole foods",
          source: "USER"
        }
      ]),
      categorySuggestionProvider: {
        suggest: async () => {
          providerCalls += 1;
          return {
            category: "GROCERIES",
            confidence: 0.8,
            rationale: "mock"
          };
        }
      },
      idempotencyRepository: new InMemoryCategorizationIdempotencyRepository(),
      auditTrailRepository: new InMemoryAuditTrailRepository(),
      now: () => new Date("2026-07-18T00:20:00.000Z")
    });

    const result = await useCase.execute({
      transactionId: "txn-1",
      authenticatedUserId: "user-1",
      idempotencyKey: "suggest-idem-0001"
    });

    expect(result.deterministicResult?.category).toBe("GROCERIES");
    expect(result.suggestion).toBeNull();
    expect(providerCalls).toBe(0);
  });

  it("is side-effect idempotent and returns same response for repeated key", async () => {
    let providerCalls = 0;
    const audit = new InMemoryAuditTrailRepository();

    const useCase = new SuggestTransactionCategoryUseCase({
      transactionRepository: new InMemoryTransactionRepository([
        {
          transactionId: "txn-2",
          accountId: "card-1",
          ownerUserId: "user-1",
          description: "Unknown Merchant",
          amountMinor: 7500n,
          direction: "DEBIT"
        }
      ]),
      categorizationRuleRepository: new InMemoryCategorizationRuleRepository([]),
      categorySuggestionProvider: {
        suggest: async () => {
          providerCalls += 1;
          return {
            category: "UNCATEGORIZED",
            confidence: 0.25,
            rationale: "mock"
          };
        }
      },
      idempotencyRepository: new InMemoryCategorizationIdempotencyRepository(),
      auditTrailRepository: audit,
      now: () => new Date("2026-07-18T00:21:00.000Z")
    });

    const first = await useCase.execute({
      transactionId: "txn-2",
      authenticatedUserId: "user-1",
      idempotencyKey: "suggest-idem-0002"
    });

    const second = await useCase.execute({
      transactionId: "txn-2",
      authenticatedUserId: "user-1",
      idempotencyKey: "suggest-idem-0002"
    });

    expect(second).toEqual(first);
    expect(providerCalls).toBe(1);
    expect(audit.records.length).toBe(1);
  });

  it("returns deterministic match even when AI provider would fail", async () => {
    const useCase = new SuggestTransactionCategoryUseCase({
      transactionRepository: new InMemoryTransactionRepository([
        {
          transactionId: "txn-3",
          accountId: "card-1",
          ownerUserId: "user-1",
          description: "Whole Foods",
          amountMinor: 6500n,
          direction: "DEBIT"
        }
      ]),
      categorizationRuleRepository: new InMemoryCategorizationRuleRepository([
        {
          id: "rule-2",
          ownerUserId: "user-1",
          priority: 1,
          category: "GROCERIES",
          ruleType: "EXACT_MERCHANT",
          merchantNormalized: "whole foods",
          source: "USER"
        }
      ]),
      categorySuggestionProvider: {
        suggest: async () => {
          throw new Error("provider_failure");
        }
      },
      idempotencyRepository: new InMemoryCategorizationIdempotencyRepository(),
      auditTrailRepository: new InMemoryAuditTrailRepository(),
      now: () => new Date("2026-07-18T00:22:00.000Z")
    });

    const result = await useCase.execute({
      transactionId: "txn-3",
      authenticatedUserId: "user-1",
      idempotencyKey: "suggest-idem-0003"
    });

    expect(result.deterministicResult?.category).toBe("GROCERIES");
    expect(result.suggestion).toBeNull();
  });

  it("does not persist suggestion as confirmed category", async () => {
    const transactionRepository = new InMemoryTransactionRepository([
      {
        transactionId: "txn-4",
        accountId: "card-1",
        ownerUserId: "user-1",
        description: "Unknown merchant",
        amountMinor: 3100n,
        direction: "DEBIT"
      }
    ]);

    const useCase = new SuggestTransactionCategoryUseCase({
      transactionRepository,
      categorizationRuleRepository: new InMemoryCategorizationRuleRepository([]),
      categorySuggestionProvider: {
        suggest: async () => ({
          category: "UNCATEGORIZED",
          confidence: 0.3,
          rationale: "mock"
        })
      },
      idempotencyRepository: new InMemoryCategorizationIdempotencyRepository(),
      auditTrailRepository: new InMemoryAuditTrailRepository(),
      now: () => new Date("2026-07-18T00:23:00.000Z")
    });

    const result = await useCase.execute({
      transactionId: "txn-4",
      authenticatedUserId: "user-1",
      idempotencyKey: "suggest-idem-0004"
    });

    const transactionState = transactionRepository.getTransactionState("txn-4");
    expect(result.suggestion).toBeTruthy();
    expect(transactionState?.confirmedCategory).toBeUndefined();
    expect(transactionState?.categorySource).toBeUndefined();
  });
});
