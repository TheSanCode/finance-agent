import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { initializeApp, getApps } from "firebase-admin/app";

const ensureFirebaseApp = (): void => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export class FirebaseAuthService {
  async verifyBearerToken(token: string): Promise<DecodedIdToken> {
    ensureFirebaseApp();
    return getAuth().verifyIdToken(token);
  }
}
