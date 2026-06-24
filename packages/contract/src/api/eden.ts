export type EdenResponse<T> = {
  data: T | null;
  error: unknown;
  status: number;
};
