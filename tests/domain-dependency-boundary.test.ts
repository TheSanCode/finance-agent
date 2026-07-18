import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("domain dependency boundary", () => {
  it("does not import infrastructure, web, or AI frameworks", () => {
    const bannedPatterns = [
      /firebase-admin/i,
      /firestore/i,
      /from\s+["']express["']/i,
      /from\s+["']genkit["']/i,
      /googleAI/i,
      /gemini/i
    ];

    const domainDir = join(process.cwd(), "packages", "domain", "src");
    const files = readdirSync(domainDir).filter((name) => name.endsWith(".ts"));

    for (const file of files) {
      const source = readFileSync(join(domainDir, file), "utf-8");
      for (const pattern of bannedPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
