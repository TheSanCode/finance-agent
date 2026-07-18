import { describe, expect, it } from "vitest";

import { addMoney, makeMoney, subtractMoney } from "../packages/domain/src/money.js";

describe("money deterministic operations", () => {
  it("adds minor units deterministically", () => {
    const left = makeMoney(105n, "USD");
    const right = makeMoney(95n, "USD");

    const result = addMoney(left, right);

    expect(result.amountMinor).toBe(200n);
    expect(result.currency).toBe("USD");
  });

  it("rejects currency mismatch", () => {
    const left = makeMoney(105n, "USD");
    const right = makeMoney(95n, "EUR");

    expect(() => subtractMoney(left, right)).toThrowError("Currency mismatch");
  });
});
