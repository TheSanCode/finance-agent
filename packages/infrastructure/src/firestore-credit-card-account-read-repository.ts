import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

import { type CreditCardAccountReadRepository } from "../../application/src/ports.js";
import { makeMoney } from "../../domain/src/money.js";
import { type CreditCardAccount } from "../../domain/src/credit-card-summary.js";

const creditCardAccountDocSchema = z.object({
  accountId: z.string().min(1),
  ownerUserId: z.string().min(1),
  currency: z.string().length(3),
  creditLimitMinor: z.string().regex(/^-?\d+$/),
  currentBalanceMinor: z.string().regex(/^-?\d+$/)
});

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirestoreCreditCardAccountReadRepository implements CreditCardAccountReadRepository {
  async findByAccountIdForUser(input: {
    accountId: string;
    ownerUserId: string;
  }): Promise<CreditCardAccount | null> {
    ensureFirebaseApp();

    const db = getFirestore();
    const snapshot = await db
      .collection("creditCardAccounts")
      .where("accountId", "==", input.accountId)
      .where("ownerUserId", "==", input.ownerUserId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const parsed = creditCardAccountDocSchema.parse(snapshot.docs[0].data());

    return {
      accountId: parsed.accountId,
      ownerUserId: parsed.ownerUserId,
      creditLimit: makeMoney(BigInt(parsed.creditLimitMinor), parsed.currency),
      currentBalance: makeMoney(BigInt(parsed.currentBalanceMinor), parsed.currency)
    };
  }
}
