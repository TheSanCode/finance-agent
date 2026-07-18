import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type ImportedTransactionRepository } from "../../application/src/ports.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirestoreImportedTransactionRepository implements ImportedTransactionRepository {
  async importApprovedRows(input: {
    previewId: string;
    accountId: string;
    actorId: string;
    rows: ReadonlyArray<{
      rowNumber: number;
      occurredOn: string;
      description: string;
      amount: { amountMinor: bigint; currency: string };
      fingerprint: string;
    }>;
    importedAt: string;
  }): Promise<{ importedCount: number }> {
    ensureFirebaseApp();
    const db = getFirestore();

    const batch = db.batch();
    for (const row of input.rows) {
      const ref = db.collection("importedTransactions").doc();
      batch.set(ref, {
        previewId: input.previewId,
        accountId: input.accountId,
        actorId: input.actorId,
        importedAt: input.importedAt,
        rowNumber: row.rowNumber,
        occurredOn: row.occurredOn,
        description: row.description,
        amountMinor: row.amount.amountMinor.toString(),
        currency: row.amount.currency,
        fingerprint: row.fingerprint
      });
    }

    await batch.commit();

    return { importedCount: input.rows.length };
  }
}
