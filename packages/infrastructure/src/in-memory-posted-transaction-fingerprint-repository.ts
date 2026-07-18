import { type PostedTransactionFingerprintReadRepository } from "../../application/src/ports.js";

export class InMemoryPostedTransactionFingerprintReadRepository implements PostedTransactionFingerprintReadRepository {
  constructor(private readonly data: Readonly<Record<string, ReadonlyArray<string>>>) {}

  async listForAccount(accountId: string): Promise<ReadonlyArray<string>> {
    return this.data[accountId] ?? [];
  }
}
