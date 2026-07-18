import { type AuditTrailRepository } from "../../application/src/ports.js";

export class InMemoryAuditTrailRepository implements AuditTrailRepository {
  records: Array<{
    accountId: string;
    actorId: string;
    action: string;
    timestamp: string;
    metadata: Record<string, string | number | boolean>;
  }> = [];

  async record(input: {
    accountId: string;
    actorId: string;
    action: string;
    timestamp: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    this.records.push(input);
  }
}
