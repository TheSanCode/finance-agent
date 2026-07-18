import { describe, expect, it } from "vitest";

import {
  calculateStatementTotalMinor,
  createNormalizedTransaction,
  createTransactionFingerprint,
  detectDuplicateFingerprints
} from "../packages/domain/src/statement-import.js";

describe("statement import domain", () => {
  it("creates stable deterministic fingerprint", () => {
    const first = createTransactionFingerprint({
      accountId: "card-1",
      occurredOn: "2026-07-10",
      description: "Coffee Shop",
      amountMinor: 455n,
      currency: "USD"
    });

    const second = createTransactionFingerprint({
      accountId: "card-1",
      occurredOn: "2026-07-10",
      description: "  coffee   shop  ",
      amountMinor: 455n,
      currency: "USD"
    });

    expect(first).toBe(second);
  });

  it("detects duplicates within statement deterministically", () => {
    const rows = [
      createNormalizedTransaction({
        accountId: "card-1",
        rowNumber: 2,
        occurredOn: "2026-07-10",
        description: "Coffee Shop",
        amountMinor: 455n,
        currency: "USD"
      }),
      createNormalizedTransaction({
        accountId: "card-1",
        rowNumber: 3,
        occurredOn: "2026-07-10",
        description: "coffee shop",
        amountMinor: 455n,
        currency: "USD"
      })
    ];

    const duplicates = detectDuplicateFingerprints(rows);

    expect(duplicates).toHaveLength(1);
    const firstDuplicate = duplicates[0];
    expect(firstDuplicate).toBeDefined();
    if (!firstDuplicate) {
      throw new Error("Expected duplicate candidate");
    }
    expect(firstDuplicate.rowNumbers).toEqual([2, 3]);
    expect(firstDuplicate.reason).toBe("within_statement");
  });

  it("calculates totals in minor units without floating point arithmetic", () => {
    const rows = [
      createNormalizedTransaction({
        accountId: "card-1",
        rowNumber: 2,
        occurredOn: "2026-07-10",
        description: "Coffee Shop",
        amountMinor: 455n,
        currency: "USD"
      }),
      createNormalizedTransaction({
        accountId: "card-1",
        rowNumber: 3,
        occurredOn: "2026-07-11",
        description: "Book Store",
        amountMinor: 1055n,
        currency: "USD"
      })
    ];

    expect(calculateStatementTotalMinor(rows)).toBe(1510n);
  });
});
