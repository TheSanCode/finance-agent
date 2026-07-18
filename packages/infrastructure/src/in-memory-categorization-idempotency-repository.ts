import { type CategorizationIdempotencyRepository } from "../../application/src/ports.js";

type StoredResult = {
  readonly createdAt: string;
  readonly response: Record<string, unknown>;
};

const toKey = (input: {
  operation: string;
  targetId: string;
  actorId: string;
  idempotencyKey: string;
}): string =>
  [input.operation, input.targetId, input.actorId, input.idempotencyKey]
    .map((value) => encodeURIComponent(value))
    .join("|");

export class InMemoryCategorizationIdempotencyRepository implements CategorizationIdempotencyRepository {
  private readonly results = new Map<string, StoredResult>();

  async findResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
  }): Promise<Record<string, unknown> | null> {
    return this.results.get(toKey(input))?.response ?? null;
  }

  async saveResult(input: {
    operation: string;
    targetId: string;
    actorId: string;
    idempotencyKey: string;
    createdAt: string;
    response: Record<string, unknown>;
  }): Promise<void> {
    this.results.set(toKey(input), {
      createdAt: input.createdAt,
      response: input.response
    });
  }
}
