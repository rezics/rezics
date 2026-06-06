export function hashFn(fn: any): string {
  const src = fn.toString();
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    hash = (hash * 31 + src.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
