import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp, createAppDependencies } from "../apps/api/src/app.js";
import { GetCreditCardSummaryUseCase } from "../packages/application/src/index.js";
import { InMemoryCreditCardAccountReadRepository } from "../packages/infrastructure/src/in-memory-credit-card-account-read-repository.js";
import { createLogger } from "../packages/shared/src/logger.js";

describe("health endpoint", () => {
  it("returns status ok", async () => {
    const app = createApp(
      createAppDependencies({
        logger: createLogger({ service: "finance-agent-test-health" }),
        authService: {
          verifyBearerToken: async () => ({ uid: "user-1" })
        },
        getCreditCardSummaryUseCase: new GetCreditCardSummaryUseCase(
          new InMemoryCreditCardAccountReadRepository([])
        )
      })
    );

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "finance-agent-api" });
  });
});
