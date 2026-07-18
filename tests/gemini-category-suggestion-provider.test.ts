import { describe, expect, it } from "vitest";

import { GeminiCategorySuggestionProvider } from "../packages/infrastructure/src/gemini-category-suggestion-provider.js";

describe("gemini category suggestion provider", () => {
  it("returns null for invalid JSON payload", async () => {
    const provider = new GeminiCategorySuggestionProvider() as unknown as {
      ai: { generate: () => Promise<{ text: string }> };
      suggest: GeminiCategorySuggestionProvider["suggest"];
    };

    provider.ai = {
      generate: async () => ({ text: "not-json" })
    };

    const result = await provider.suggest({
      transaction: {
        description: "Unknown merchant",
        amountMinor: 1000n,
        direction: "DEBIT"
      },
      allowedCategories: ["GROCERIES", "UNCATEGORIZED"]
    });

    expect(result).toBeNull();
  });

  it("returns null when suggested category is outside approved taxonomy", async () => {
    const provider = new GeminiCategorySuggestionProvider() as unknown as {
      ai: { generate: () => Promise<{ text: string }> };
      suggest: GeminiCategorySuggestionProvider["suggest"];
    };

    provider.ai = {
      generate: async () => ({
        text: JSON.stringify({
          category: "UNAPPROVED_CATEGORY",
          confidence: 0.7,
          rationale: "mock"
        })
      })
    };

    const result = await provider.suggest({
      transaction: {
        description: "Unknown merchant",
        amountMinor: 1000n,
        direction: "DEBIT"
      },
      allowedCategories: ["GROCERIES", "UNCATEGORIZED"]
    });

    expect(result).toBeNull();
  });
});
