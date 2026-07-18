import { z } from "zod";
import { describe, expect, it } from "vitest";

import { ControlledToolRegistry } from "../packages/agent/src/tool-registry.js";

describe("ControlledToolRegistry", () => {
  it("rejects unknown tools", async () => {
    const registry = new ControlledToolRegistry();

    await expect(registry.execute("get-health-status", {}, { actorId: "u1" })).rejects.toThrowError(
      "Tool not allowed: get-health-status"
    );
  });

  it("validates inputs with zod", async () => {
    const registry = new ControlledToolRegistry();

    registry.register("draft-journal-entry", {
      inputSchema: z.object({ accountId: z.string().min(1) }),
      run: async () => ({ ok: true })
    });

    await expect(
      registry.execute("draft-journal-entry", { accountId: "" }, { actorId: "u1" })
    ).rejects.toThrowError();
  });
});
