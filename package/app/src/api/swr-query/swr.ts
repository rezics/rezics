let accessToken: string | null = null;

const stored = localStorage.getItem("accessToken");
if (stored) {
  accessToken = stored;
}

export const tokenStore = {
  get: () => accessToken,

  set: (t: string | null) => {
    accessToken = t;
    if (t) {
      localStorage.setItem("accessToken", t);
    } else {
      localStorage.removeItem("accessToken");
    }
  },
};
type RequestInit = {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | FormData | null;
  [key: string]: any;
};

export async function fetchJSONWithBearer<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(tokenStore.get()
        ? { Authorization: `Bearer ${tokenStore.get()}` }
        : {}),
      ...(init?.headers || {}),
    },
  });
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

export async function apiPost<T>(key: T) {
  const url = "/api";
  return await fetchJSONWithBearer(url, {
    method: "POST",
    body: JSON.stringify(key),
  });
}

/**
 * 包装 apiPost，用于单独调用时的错误拦截。
 * - 成功时返回对象 (T)
 * - 出错时返回字符串 "error"
 */
export async function safeApiPost<T>(key: T): Promise<any | "error"> {
  try {
    return await apiPost<T>(key);
  } catch (err) {
    console.error("API 调用失败:", err);
    return "error";
  }
}
