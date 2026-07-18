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

  it("prefers exact merchant matches over contains matches for same source", () => {
    const transaction: CategorizableTransaction = {
      transactionId: "txn-3",
      accountId: "card-1",
      ownerUserId: "user-1",
      description: "Acme Fuel Center",
      amountMinor: 5200n,
      direction: "DEBIT"
    };

    const rules: CategorizationRule[] = [
      {
        id: "contains-rule",
        ownerUserId: "user-1",
        priority: 10,
        category: "TRANSPORTATION",
        ruleType: "MERCHANT_KEYWORD",
        keywordNormalized: "fuel",
        source: "USER"
      },
      {
        id: "exact-rule",
        ownerUserId: "user-1",
        priority: 999,
        category: "FUEL",
        ruleType: "EXACT_MERCHANT",
        merchantNormalized: "acme fuel center",
        source: "USER"
      }
    ];

    const result = evaluateCategorizationRules({ transaction, rules });

    expect(result.category).toBe("FUEL");
    expect(result.ruleId).toBe("exact-rule");
  });

  it("resolves conflicting equal-priority rules deterministically by rule id", () => {
    const transaction: CategorizableTransaction = {
      transactionId: "txn-4",
      accountId: "card-1",
      ownerUserId: "user-1",
      description: "contoso store",
      amountMinor: 4000n,
      direction: "DEBIT"
    };

    const rules: CategorizationRule[] = [
      {
        id: "rule-b",
        ownerUserId: "user-1",
        priority: 10,
        category: "SHOPPING",
        ruleType: "MERCHANT_KEYWORD",
        keywordNormalized: "contoso",
        source: "USER"
      },
      {
        id: "rule-a",
        ownerUserId: "user-1",
        priority: 10,
        category: "SHOPPING",
        ruleType: "MERCHANT_KEYWORD",
        keywordNormalized: "contoso",
        source: "USER"
      }
    ];

    const result = evaluateCategorizationRules({ transaction, rules });

    expect(result.ruleId).toBe("rule-a");
  });
});
