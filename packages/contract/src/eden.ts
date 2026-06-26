type EdenResponseMeta = {
  response: Response;
  status: number;
  headers: ResponseInit["headers"];
};

export type EdenResponseError<Status = unknown, Value = unknown> = {
  status: Status;
  value: Value;
};

/**
 * Structural subset of @elysiajs/eden's Treaty.TreatyResponse.
 *
 * Keep this local instead of importing @elysiajs/eden so @rezics/contract stays
 * independent from frontend-only client dependencies.
 */
export type EdenResponse<TData, TError = EdenResponseError> =
  | (EdenResponseMeta & {
      data: TData;
      error: null;
    })
  | (EdenResponseMeta & {
      data: null;
      error: TError;
    });
