import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type AuditTrailRepository } from "../../application/src/ports.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirestoreAuditTrailRepository implements AuditTrailRepository {
  async record(input: {
    accountId: string;
    actorId: string;
    action: string;
    timestamp: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    ensureFirebaseApp();
    const db = getFirestore();

    await db.collection("auditTrail").add({
      accountId: input.accountId,
      actorId: input.actorId,
      action: input.action,
      timestamp: input.timestamp,
      metadata: input.metadata
    });
  }
}
