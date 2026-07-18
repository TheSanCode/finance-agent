import { describe, expect, it } from "vitest";

import { calculateCreditCardSummary } from "../packages/domain/src/credit-card-summary.js";
import { makeMoney } from "../packages/domain/src/money.js";

describe("calculateCreditCardSummary", () => {
  it("calculates available credit and utilization deterministically", () => {
    const summary = calculateCreditCardSummary({
      accountId: "card-1",
      ownerUserId: "user-1",
      creditLimit: makeMoney(500000n, "USD"),
      currentBalance: makeMoney(125000n, "USD")
    });

    expect(summary.availableCredit.amountMinor).toBe(375000n);
    expect(summary.utilizationBasisPoints).toBe(2500n);
  });

  it("returns zero utilization for zero limit", () => {
    const summary = calculateCreditCardSummary({
      accountId: "card-1",
      ownerUserId: "user-1",
      creditLimit: makeMoney(0n, "USD"),
      currentBalance: makeMoney(100n, "USD")
    });

    expect(summary.utilizationBasisPoints).toBe(0n);
  });
});
