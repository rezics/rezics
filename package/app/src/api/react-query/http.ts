// src/lib/react-query/http.ts
export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function http<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(
    path.startsWith("http") ? path : `${BASE_URL}${path}`,
    {
      // 默认携带 JSON 头，可按需合并
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
    },
  );

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = (body?.message as string) ?? msg;
    } catch {}
    const err: ApiError = { status: res.status, message: msg };
    throw err;
  }
  // 对于 204/无 body 的情况，避免 JSON 解析异常
  if (res.status === 204) return undefined as unknown as T;
  const data = (await res.json()) as T;
  return data;
}
