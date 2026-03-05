import type {Prisma} from '@/prisma/client';

type JsonValue = Prisma.JsonValue;

export type EchoKVResponse = {
  value: JsonValue;
};

export type EchoKVUpsertRequest = {
  /**
   * Arbitrary JSON-compatible value to store.
   *
   * For existing usages like the notice board, this is typically
   * a JSON string, which the client then parses.
   */
  value: JsonValue;
};

export type EchoKVKeyListResponse = {
  /**
   * All keys that match the optional search condition.
   */
  keys: string[];
};
