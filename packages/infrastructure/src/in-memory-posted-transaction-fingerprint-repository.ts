import { type PostedTransactionFingerprintReadRepository } from "../../application/src/ports.js";

export class InMemoryPostedTransactionFingerprintReadRepository implements PostedTransactionFingerprintReadRepository {
  private readonly data: Record<string, string[]>;

  constructor(seed: Readonly<Record<string, ReadonlyArray<string>>>) {
    this.data = Object.fromEntries(
      Object.entries(seed).map(([accountId, fingerprints]) => [accountId, [...fingerprints]])
    );
  }

  async listForAccount(accountId: string): Promise<ReadonlyArray<string>> {
    return this.data[accountId] ?? [];
  }

  addFingerprints(accountId: string, fingerprints: ReadonlyArray<string>): void {
    const current = this.data[accountId] ?? [];
    this.data[accountId] = [...new Set([...current, ...fingerprints])];
  }
}
