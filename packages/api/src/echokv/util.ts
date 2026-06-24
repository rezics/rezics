export function parseEchoKVResponse<T>(data: any): T {
  let result: T;
  if (typeof data?.value === "string") {
    try {
      result = JSON.parse(String(data?.value)) as T;
    } catch (error) {
      throw new Error(`数据解析失败: ${error}`);
    }
  } else {
    try {
      result = data?.value as T;
    } catch (error) {
      throw new Error(`数据解析失败: ${error}`);
    }
  }
  return result;
}
