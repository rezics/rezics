import { unzipSync } from "fflate";

export type FileMap = Map<string, Uint8Array>;

export async function extractZip(file: File): Promise<FileMap> {
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  const fileMap: FileMap = new Map();
  for (const [path, data] of Object.entries(unzipped)) {
    fileMap.set(path, data);
  }

  return fileMap;
}

export function readText(fileMap: FileMap, path: string): string | null {
  const data = fileMap.get(path);
  if (!data) return null;
  return new TextDecoder().decode(data);
}
