import { describe, expect, it } from "vitest";

import { CategorizeImportedStatementUseCase } from "../packages/application/src/categorize-imported-statement.js";
import { InMemoryCategorizationIdempotencyRepository } from "../packages/infrastructure/src/in-memory-categorization-idempotency-repository.js";
import { InMemoryTransactionRepository } from "../packages/infrastructure/src/in-memory-transaction-repository.js";

describe("categorize imported statement use case", () => {
  it("is idempotent and suppresses repeated side effects on repeated idempotency key", async () => {
    const transactionRepository = new InMemoryTransactionRepository([
      {
        transactionId: "txn-1",
        accountId: "card-1",
        ownerUserId: "user-1",
        description: "Whole Foods",
        amountMinor: 1000n,
        direction: "DEBIT",
        importId: "import-1"
      },
      {
        transactionId: "txn-2",
        accountId: "card-1",
        ownerUserId: "user-1",
        description: "Unknown merchant",
        amountMinor: 2000n,
        direction: "DEBIT",
        importId: "import-1"
      }
    ]);

    let categorizeCalls = 0;

    const useCase = new CategorizeImportedStatementUseCase({
      transactionRepository,
      idempotencyRepository: new InMemoryCategorizationIdempotencyRepository(),
      categorizeTransactionUseCase: {
        execute: async (input: {
          transactionId: string;
          authenticatedUserId: string;
          idempotencyKey: string;
        }) => {
          void input;
          categorizeCalls += 1;
          return {
            transactionId: "synthetic",
            category: categorizeCalls === 1 ? "GROCERIES" : "UNCATEGORIZED",
            source: "USER_RULE",
            confidence: 0.95,
            explanation: "synthetic"
          };
        }
      },
      now: () => new Date("2026-07-18T00:25:00.000Z")
    });

    const first = await useCase.execute({
      importId: "import-1",
      authenticatedUserId: "user-1",
      idempotencyKey: "bulk-idem-0001"
    });

    const callsAfterFirst = categorizeCalls;

    const second = await useCase.execute({
      importId: "import-1",
      authenticatedUserId: "user-1",
      idempotencyKey: "bulk-idem-0001"
    });

    expect(second).toEqual(first);
    expect(callsAfterFirst).toBe(2);
    expect(categorizeCalls).toBe(callsAfterFirst);
  });
});
