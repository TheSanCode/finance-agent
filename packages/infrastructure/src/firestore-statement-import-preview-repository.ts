import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { type StatementImportPreviewRepository } from "../../application/src/ports.js";
import {
  type StatementImportPreview,
  type StatementImportStatus
} from "../../domain/src/statement-import.js";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

const serializePreview = (preview: StatementImportPreview) => ({
  ...preview,
  rows: preview.rows.map((row) => ({
    ...row,
    amount: {
      amountMinor: row.amount.amountMinor.toString(),
      currency: row.amount.currency
    }
  }))
});

const deserializePreview = (preview: StatementImportPreview): StatementImportPreview => ({
  ...preview,
  rows: preview.rows.map((row) => ({
    ...row,
    amount: {
      amountMinor: BigInt(row.amount.amountMinor as unknown as string),
      currency: row.amount.currency
    }
  }))
});

export class FirestoreStatementImportPreviewRepository implements StatementImportPreviewRepository {
  async create(preview: StatementImportPreview): Promise<StatementImportPreview> {
    ensureFirebaseApp();
    const db = getFirestore();
    await db
      .collection("statementImportPreviews")
      .doc(preview.previewId)
      .set(serializePreview(preview));
    return preview;
  }

  async findByIdForUser(input: {
    previewId: string;
    ownerUserId: string;
  }): Promise<StatementImportPreview | null> {
    ensureFirebaseApp();
    const db = getFirestore();
    const doc = await db.collection("statementImportPreviews").doc(input.previewId).get();

    if (!doc.exists) {
      return null;
    }

    const data = deserializePreview(doc.data() as StatementImportPreview);
    if (data.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return data;
  }

  async updateStatus(input: {
    previewId: string;
    status: StatementImportStatus;
    approvedBy?: string;
    approvedAt?: string;
    importedAt?: string;
  }): Promise<StatementImportPreview> {
    ensureFirebaseApp();
    const db = getFirestore();
    const ref = db.collection("statementImportPreviews").doc(input.previewId);
    await ref.update({
      status: input.status,
      ...(input.approvedBy ? { approvedBy: input.approvedBy } : {}),
      ...(input.approvedAt ? { approvedAt: input.approvedAt } : {}),
      ...(input.importedAt ? { importedAt: input.importedAt } : {})
    });

    const updated = await ref.get();
    return deserializePreview(updated.data() as StatementImportPreview);
  }

  async findApprovalByIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<{ importedCount: number; importedAt: string } | null> {
    ensureFirebaseApp();
    const db = getFirestore();
    const id = `${input.previewId}|${input.actorId}|${input.idempotencyKey}`;
    const doc = await db.collection("statementImportApprovals").doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as { importedCount: number; importedAt: string };
  }

  async saveApprovalIdempotencyKey(input: {
    previewId: string;
    actorId: string;
    idempotencyKey: string;
    importedCount: number;
    importedAt: string;
  }): Promise<void> {
    ensureFirebaseApp();
    const db = getFirestore();
    const id = `${input.previewId}|${input.actorId}|${input.idempotencyKey}`;
    await db.collection("statementImportApprovals").doc(id).set({
      importedCount: input.importedCount,
      importedAt: input.importedAt
    });
  }
}
