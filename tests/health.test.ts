import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../apps/api/src/app.js";

describe("health endpoint", () => {
  it("returns status ok", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "finance-agent-api" });
  });
});
