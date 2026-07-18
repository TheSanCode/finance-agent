import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type LedgerEntryDraft, type LedgerRepository } from "../../application/src/ports.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirestoreLedgerRepository implements LedgerRepository {
  async saveEntry(input: LedgerEntryDraft): Promise<{ id: string }> {
    ensureFirebaseApp();

    const db = getFirestore();
    const docRef = db.collection("ledgerEntries").doc();

    await docRef.set({
      accountId: input.accountId,
      amountMinor: input.amount.amountMinor.toString(),
      currency: input.amount.currency,
      description: input.description,
      createdAt: new Date().toISOString()
    });

    return { id: docRef.id };
  }
}
