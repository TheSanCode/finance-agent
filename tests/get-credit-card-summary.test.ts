import { describe, expect, it } from "vitest";

import {
  GetCreditCardSummaryUseCase,
  NotFoundApplicationError,
  ValidationApplicationError
} from "../packages/application/src/index.js";
import { makeMoney } from "../packages/domain/src/money.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";

describe("GetCreditCardSummaryUseCase", () => {
  it("returns a deterministic summary for an authorized account owner", async () => {
    const repository = new InMemoryCreditCardAccountReadRepository([
      {
        accountId: "card-1",
        ownerUserId: "user-1",
        creditLimit: makeMoney(100000n, "USD"),
        currentBalance: makeMoney(25000n, "USD")
      }
    ]);

    const useCase = new GetCreditCardSummaryUseCase(repository);
    const summary = await useCase.execute({
      accountId: "card-1",
      authenticatedUserId: "user-1"
    });

    expect(summary).toEqual({
      accountId: "card-1",
      currency: "USD",
      creditLimitMinor: "100000",
      currentBalanceMinor: "25000",
      availableCreditMinor: "75000",
      utilizationBasisPoints: "2500"
    });
  });

  it("returns not_found when user requests another user's account", async () => {
    const repository = new InMemoryCreditCardAccountReadRepository([
      {
        accountId: "card-1",
        ownerUserId: "user-1",
        creditLimit: makeMoney(100000n, "USD"),
        currentBalance: makeMoney(25000n, "USD")
      }
    ]);

    const useCase = new GetCreditCardSummaryUseCase(repository);

    await expect(
      useCase.execute({
        accountId: "card-1",
        authenticatedUserId: "user-2"
      })
    ).rejects.toBeInstanceOf(NotFoundApplicationError);
  });

  it("returns validation_error on invalid input", async () => {
    const useCase = new GetCreditCardSummaryUseCase(
      new InMemoryCreditCardAccountReadRepository([])
    );

    await expect(
      useCase.execute({
        accountId: "",
        authenticatedUserId: "user-1"
      })
    ).rejects.toBeInstanceOf(ValidationApplicationError);
  });
});
