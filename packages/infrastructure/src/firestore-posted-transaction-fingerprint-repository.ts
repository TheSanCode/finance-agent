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

    const postedSnapshot = await db
      .collection("postedTransactions")
      .where("accountId", "==", accountId)
      .select("fingerprint")
      .get();

    const importedSnapshot = await db
      .collection("importedTransactions")
      .where("accountId", "==", accountId)
      .select("fingerprint")
      .get();

    const fingerprints = [...postedSnapshot.docs, ...importedSnapshot.docs]
      .map((doc: QueryDocumentSnapshot) => doc.get("fingerprint"))
      .filter((value: unknown): value is string => typeof value === "string");

    return [...new Set(fingerprints)];
  }
}
