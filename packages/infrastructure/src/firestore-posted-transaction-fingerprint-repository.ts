import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";

import { type PostedTransactionFingerprintReadRepository } from "../../application/src/ports.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirestorePostedTransactionFingerprintReadRepository implements PostedTransactionFingerprintReadRepository {
  async listForAccount(accountId: string): Promise<ReadonlyArray<string>> {
    ensureFirebaseApp();
    const db = getFirestore();
    const snapshot = await db
      .collection("postedTransactions")
      .where("accountId", "==", accountId)
      .select("fingerprint")
      .get();

    return snapshot.docs
      .map((doc: QueryDocumentSnapshot) => doc.get("fingerprint"))
      .filter((value: unknown): value is string => typeof value === "string");
  }
}
