import { describe, expect, it } from "vitest";

import {
  evaluateCategorizationRules,
  type CategorizableTransaction,
  type CategorizationRule
} from "../packages/domain/src/transaction-categorization.js";

describe("transaction categorization domain", () => {
  it("prefers user exact merchant rule before system rules", () => {
    const transaction: CategorizableTransaction = {
      transactionId: "txn-1",
      accountId: "card-1",
      ownerUserId: "user-1",
      description: "Whole Foods Market",
      amountMinor: 12500n,
      direction: "DEBIT"
    };

    const rules: CategorizationRule[] = [
      {
        id: "system-keyword",
        priority: 100,
        category: "GROCERIES",
        ruleType: "MERCHANT_KEYWORD",
        keywordNormalized: "market",
        source: "SYSTEM"
      },
      {
        id: "user-exact",
        ownerUserId: "user-1",
        priority: 10,
        category: "GROCERIES",
        ruleType: "EXACT_MERCHANT",
        merchantNormalized: "whole foods market",
        source: "USER"
      }
    ];

    const result = evaluateCategorizationRules({ transaction, rules });

    expect(result.category).toBe("GROCERIES");
    expect(result.source).toBe("USER_RULE");
    expect(result.ruleId).toBe("user-exact");
  });

  it("returns existing user confirmed category without overwrite", () => {
    const transaction: CategorizableTransaction = {
      transactionId: "txn-2",
      accountId: "card-1",
      ownerUserId: "user-1",
      description: "Uber Trip",
      amountMinor: 1899n,
      direction: "DEBIT",
      confirmedCategory: "TRANSPORTATION"
    };

    const result = evaluateCategorizationRules({
      transaction,
      rules: []
    });

    expect(result.category).toBe("TRANSPORTATION");
    expect(result.source).toBe("USER_CONFIRMED");
    expect(result.confidence).toBe(1);
  });
});
