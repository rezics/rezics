import type {JsonValue} from '@prisma/client/runtime/library';

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
