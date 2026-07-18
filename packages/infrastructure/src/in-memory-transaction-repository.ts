import {
  type CategorizableTransaction,
  categorySchema,
  type Category,
  type CategorizationSource
} from "../../domain/src/transaction-categorization.js";
import {
  type TransactionCategorizationUpdate,
  type TransactionRepository
} from "../../application/src/ports.js";

type StoredTransaction = CategorizableTransaction & {
  category?: Category;
  categorySource?: CategorizationSource;
  categoryConfidence?: number;
  categoryExplanation?: string;
  categoryRuleId?: string;
};

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<string, StoredTransaction>();

  constructor(seed: ReadonlyArray<StoredTransaction> = []) {
    for (const transaction of seed) {
      this.transactions.set(transaction.transactionId, transaction);
    }
  }

  async findByIdForUser(input: {
    transactionId: string;
    ownerUserId: string;
  }): Promise<CategorizableTransaction | null> {
    const transaction = this.transactions.get(input.transactionId);
    if (!transaction || transaction.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return {
      transactionId: transaction.transactionId,
      accountId: transaction.accountId,
      ownerUserId: transaction.ownerUserId,
      description: transaction.description,
      amountMinor: transaction.amountMinor,
      direction: transaction.direction,
      confirmedCategory: transaction.confirmedCategory,
      importId: transaction.importId
    };
  }

  async listByImportIdForUser(input: {
    importId: string;
    ownerUserId: string;
  }): Promise<ReadonlyArray<CategorizableTransaction>> {
    return [...this.transactions.values()]
      .filter((transaction) => {
        return (
          transaction.ownerUserId === input.ownerUserId && transaction.importId === input.importId
        );
      })
      .map((transaction) => ({
        transactionId: transaction.transactionId,
        accountId: transaction.accountId,
        ownerUserId: transaction.ownerUserId,
        description: transaction.description,
        amountMinor: transaction.amountMinor,
        direction: transaction.direction,
        confirmedCategory: transaction.confirmedCategory,
        importId: transaction.importId
      }));
  }

  async saveCategorization(input: {
    transactionId: string;
    ownerUserId: string;
    update: TransactionCategorizationUpdate;
  }): Promise<void> {
    const existing = this.transactions.get(input.transactionId);
    if (!existing || existing.ownerUserId !== input.ownerUserId) {
      return;
    }

    const update = input.update;
    this.transactions.set(input.transactionId, {
      ...existing,
      confirmedCategory: update.confirmed ? update.category : existing.confirmedCategory,
      category: categorySchema.parse(update.category),
      categorySource: update.source,
      categoryConfidence: update.confidence,
      categoryExplanation: update.explanation,
      categoryRuleId: update.ruleId
    });
  }

  getTransactionState(transactionId: string): StoredTransaction | undefined {
    return this.transactions.get(transactionId);
  }
}
