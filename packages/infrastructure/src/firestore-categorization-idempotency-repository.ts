import { createHash } from "node:crypto";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type CategorizationIdempotencyRepository } from "../../application/src/ports.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

const buildDocId = (input: {
  operation: string;
  targetId: string;
  actorId: string;
  idempotencyKey: string;
}): string => {
  const canonical = [input.operation, input.targetId, input.actorId, input.idempotencyKey].join(
    "|"
  );
  return createHash("sha256").update(canonical).digest("hex");
};

export class FirestoreCategorizationIdempotencyRepository implements CategorizationIdempotencyRepository {
  async findResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<Record<string, unknown> | null> {
    ensureFirebaseApp();
    const db = getFirestore();

    const snapshot = await db.collection("categorizationIdempotency").doc(buildDocId(input)).get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    const response = data?.response;
    if (!response || typeof response !== "object") {
      return null;
    }

    return response as Record<string, unknown>;
  }

  async saveResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
    createdAt: string;
    response: Record<string, unknown>;
  }): Promise<void> {
    ensureFirebaseApp();
    const db = getFirestore();

    await db.collection("categorizationIdempotency").doc(buildDocId(input)).set(
      {
        operation: input.operation,
        targetId: input.targetId,
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
        createdAt: input.createdAt,
        response: input.response
      },
      { merge: true }
    );
  }
}
