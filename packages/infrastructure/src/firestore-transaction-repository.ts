import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type TransactionRepository } from "../../application/src/ports.js";
import {
  type CategorizableTransaction,
  categorySchema,
  categorizationSourceSchema
} from "../../domain/src/transaction-categorization.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

const toTransaction = (
  id: string,
  data: Record<string, unknown>
): CategorizableTransaction | null => {
  const ownerUserId = data.ownerUserId;
  const accountId = data.accountId;
  const description = data.description;
  const amountMinor = data.amountMinor;
  const direction = data.direction;

  if (
    typeof ownerUserId !== "string" ||
    typeof accountId !== "string" ||
    typeof description !== "string" ||
    typeof amountMinor !== "string" ||
    (direction !== "DEBIT" && direction !== "CREDIT")
  ) {
    return null;
  }

  try {
    return {
      transactionId: id,
      accountId,
      ownerUserId,
      description,
      amountMinor: BigInt(amountMinor),
      direction,
      confirmedCategory:
        typeof data.confirmedCategory === "string"
          ? categorySchema.parse(data.confirmedCategory)
          : undefined,
      importId: typeof data.importId === "string" ? data.importId : undefined
    };
  } catch {
    return null;
  }
};

export class FirestoreTransactionRepository implements TransactionRepository {
  async findByIdForUser(input: {
    transactionId: string;
    ownerUserId: string;
  }): Promise<CategorizableTransaction | null> {
    ensureFirebaseApp();
    const db = getFirestore();

    const snapshot = await db.collection("transactions").doc(input.transactionId).get();
    if (!snapshot.exists) {
      return null;
    }

    const transaction = toTransaction(snapshot.id, snapshot.data());
    if (!transaction || transaction.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return transaction;
  }

  async listByImportIdForUser(input: {
    importId: string;
    ownerUserId: string;
  }): Promise<ReadonlyArray<CategorizableTransaction>> {
    ensureFirebaseApp();
    const db = getFirestore();

    const snapshot = await db
      .collection("transactions")
      .where("ownerUserId", "==", input.ownerUserId)
      .where("importId", "==", input.importId)
      .get();

    const transactions: CategorizableTransaction[] = [];
    for (const doc of snapshot.docs) {
      const transaction = toTransaction(doc.id, doc.data());
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  async saveCategorization(input: {
    transactionId: string;
    ownerUserId: string;
    update: {
      category: string;
      source: string;
      confidence: number;
      explanation: string;
      ruleId?: string;
      confirmed: boolean;
    };
  }): Promise<void> {
    ensureFirebaseApp();
    const db = getFirestore();

    const category = categorySchema.parse(input.update.category);
    const source = categorizationSourceSchema.parse(input.update.source);

    await db
      .collection("transactions")
      .doc(input.transactionId)
      .set(
        {
          ownerUserId: input.ownerUserId,
          category,
          categorySource: source,
          categoryConfidence: input.update.confidence,
          categoryExplanation: input.update.explanation,
          categoryRuleId: input.update.ruleId ?? null,
          confirmedCategory: input.update.confirmed ? category : null,
          categorizedAt: new Date().toISOString()
        },
        { merge: true }
      );
  }
}
