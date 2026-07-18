import { type CreditCardAccountReadRepository } from "../../application/src/ports.js";
import { type CreditCardAccount } from "../../domain/src/credit-card-summary.js";

export class InMemoryCreditCardAccountReadRepository implements CreditCardAccountReadRepository {
  constructor(private readonly accounts: ReadonlyArray<CreditCardAccount>) {}

  async findByAccountIdForUser(input: {
    accountId: string;
    ownerUserId: string;
  }): Promise<CreditCardAccount | null> {
    const account = this.accounts.find(
      (item) => item.accountId === input.accountId && item.ownerUserId === input.ownerUserId
    );

    return account ?? null;
  }
}
