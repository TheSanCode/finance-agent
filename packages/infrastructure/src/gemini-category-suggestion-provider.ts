import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { z } from "zod";

import { type CategorySuggestionProvider } from "../../application/src/ports.js";
import { type Category } from "../../domain/src/transaction-categorization.js";

const suggestionSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1)
});

export class GeminiCategorySuggestionProvider implements CategorySuggestionProvider {
  private readonly ai = genkit({
    plugins: [googleAI()],
    model: "googleai/gemini-2.0-flash"
  });

  async suggest(input: {
    transaction: {
      description: string;
      amountMinor: bigint;
      direction: "DEBIT" | "CREDIT";
    };
    allowedCategories: ReadonlyArray<Category>;
  }): Promise<{
    category: Category;
    confidence: number;
    rationale: string;
  } | null> {
    const prompt = [
      "You are a financial categorization assistant.",
      "Return strict JSON with fields: category, confidence, rationale.",
      `Allowed categories: ${input.allowedCategories.join(",")}`,
      `Description: ${input.transaction.description}`,
      `AmountMinor: ${input.transaction.amountMinor.toString()}`,
      `Direction: ${input.transaction.direction}`
    ].join("\n");

    let parsed;

    try {
      const response = await this.ai.generate({ prompt });
      parsed = suggestionSchema.parse(JSON.parse(response.text));
    } catch {
      return null;
    }

    if (!input.allowedCategories.includes(parsed.category as Category)) {
      return null;
    }

    return {
      category: parsed.category as Category,
      confidence: parsed.confidence,
      rationale: parsed.rationale
    };
  }
}
