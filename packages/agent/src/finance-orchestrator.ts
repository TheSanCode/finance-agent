import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

import { type ControlledToolRegistry } from "./tool-registry.js";

export class FinanceOrchestrator {
  constructor(private readonly toolRegistry: ControlledToolRegistry) {}

  readonly ai = genkit({
    plugins: [googleAI()],
    model: "googleai/gemini-2.0-flash"
  });

  async runTool(toolName: "draft-journal-entry" | "get-health-status", input: unknown) {
    // No direct DB access: all mutations are routed through approved application use cases.
    return this.toolRegistry.execute(toolName, input, { actorId: "system" });
  }
}
