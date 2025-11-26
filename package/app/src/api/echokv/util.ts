export function parseEchoKVResponse<T>(data: any): T {
  let result: T;
  if (typeof data?.value === 'string') {
    try {
      result = JSON.parse(String(data?.value)) as T;
    } catch (error) {
      throw new Error(`数据解析失败: ${error}`);
    }
  }
  if (typeof data?.value === 'object') {
    try {
      result = data?.value as T;
    } catch (error) {
      throw new Error(`数据解析失败: ${error}`);
    }
  } else {
    if (!data?.value && data?.value !== undefined) {
      throw new Error(`数据格式错误: ${typeof data?.value}`);
    }
    result = [] as T;
  }
  return result;
}
