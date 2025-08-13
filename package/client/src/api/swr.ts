export async function apiPost<T>(key: T) {
  const _res = await fetch("/api", {
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
