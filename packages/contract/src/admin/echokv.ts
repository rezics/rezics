import { t } from "elysia";

export type EchoKvJsonValue =
  | string
  | number
  | boolean
  | null
  | EchoKvJsonValue[]
  | { [key: string]: EchoKvJsonValue };

export const echoKvJsonValueSchema: ReturnType<typeof t.Recursive> =
  t.Recursive((self) =>
    t.Union([
      t.String(),
      t.Number(),
      t.Boolean(),
      t.Null(),
      t.Array(self),
      t.Record(t.String(), self),
    ]),
  );

export const echoKvKeyListQuerySchema = t.Object({
  search: t.Optional(t.String()),
});

export type EchoKvKeyListQuery =
  (typeof echoKvKeyListQuerySchema)["static"];

export const echoKvKeyListResponseSchema = t.Object({
  /**
   * All keys that match the optional search condition.
   */
  keys: t.Array(t.String()),
});

export type EchoKvKeyListResponse =
  (typeof echoKvKeyListResponseSchema)["static"];

export const echoKvResponseSchema = t.Object({
  value: echoKvJsonValueSchema,
});

export type EchoKvResponse<TValue = EchoKvJsonValue> = {
  value: TValue;
};

export const echoKvUpsertRequestSchema = t.Object({
  /**
   * Arbitrary JSON-compatible value to store.
   *
   * For existing usages like the notice board, this is typically
   * a JSON string, which the client then parses.
   */
  value: echoKvJsonValueSchema,
});

export type EchoKvUpsertRequest = {
  value: EchoKvJsonValue;
};
