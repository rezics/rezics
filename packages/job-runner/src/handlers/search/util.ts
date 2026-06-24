export interface MeiliTaskMetadata {
  taskUid: number;
  index?: string;
}

export interface HandlerOutputMetadata {
  meiliTasks?: MeiliTaskMetadata[];
  result?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function extractMeiliTaskMetadata(
  value: unknown,
  index?: string,
): MeiliTaskMetadata[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractMeiliTaskMetadata(item, index));
  }
  if (!isRecord(value)) return [];
  const taskUid = value.taskUid;
  if (typeof taskUid !== "number") return [];
  return [{ taskUid, index }];
}

export async function withHandlerMetadata(
  operation: () => Promise<unknown>,
  options: { index?: string } = {},
): Promise<HandlerOutputMetadata> {
  const result = await operation();
  const meiliTasks = extractMeiliTaskMetadata(result, options.index);
  return {
    ...(meiliTasks.length > 0 ? { meiliTasks } : {}),
    ...(result !== undefined ? { result } : {}),
  };
}

export function isRetryableError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = error.code ?? (isRecord(error.cause) ? error.cause.code : null);
  if (typeof code !== "string") return false;
  return [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "too_many_requests",
    "internal",
  ].includes(code);
}
