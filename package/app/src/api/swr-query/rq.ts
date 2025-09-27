import { getAccessToken, refreshToken } from "../auth.ts";

type RequestInitLike = {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | FormData | null;
  [key: string]: any;
};

async function fetchJSONWithAuth<T>(url: string, init?: RequestInitLike): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    const newToken = await refreshToken();
    if (!newToken) {
      const err: any = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    const retry = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...(init?.headers || {}),
      },
    });
    if (!retry.ok) {
      const err: any = new Error("HTTP error after refresh");
      err.status = retry.status;
      try {
        err.data = await retry.json();
      } catch {
        // empty
      }
      throw err;
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    const err: any = new Error("HTTP error");
    err.status = res.status;
    try {
      err.data = await res.json();
    } catch {
      // empty
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function rpcPost<T>(key: unknown): Promise<T> {
  return await fetchJSONWithAuth<T>("/api", {
    method: "POST",
    body: JSON.stringify(key),
  });
}

export async function safeRpcPost<T>(key: unknown): Promise<T | "error"> {
  try {
    return await rpcPost<T>(key);
  } catch (err) {
    console.error("RPC 调用失败:", err);
    return "error";
  }
}
