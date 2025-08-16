export async function apiPost<T>(key: T) {
  const _res = await fetch("/api", {
    // https://example.com/api
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(key),
  });
  if (!_res.ok) {
    throw new Error(`Request failed: ${_res.status}`);
  }
  return (await _res.json()) as any;
}

/**
 * 包装 apiPost，用于单独调用时的错误拦截。
 * - 成功时返回对象 (T)
 * - 出错时返回字符串 "error"
 */
export async function useApiPost<T>(key: T): Promise<any | "error"> {
  try {
    return await apiPost<T>(key);
  } catch (err) {
    console.error("API 调用失败:", err);
    return "error";
  }
}
