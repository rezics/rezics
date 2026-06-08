import { XMLParser } from "fast-xml-parser";
import type { FileMap } from "./zip";
import { readText } from "./zip";

export function parseContainer(fileMap: FileMap): string {
  const xml = readText(fileMap, "META-INF/container.xml");
  if (!xml) {
    throw new Error("Missing META-INF/container.xml");
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);

  const rootfiles = doc?.container?.rootfiles?.rootfile;
  if (!rootfiles) {
    throw new Error("No rootfile found in container.xml");
  }

  // Handle single or array of rootfiles
  // 处理单个或数组形式的 rootfiles
  const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles;
  const fullPath = rootfile?.["@_full-path"];

  if (!fullPath) {
    throw new Error("No full-path attribute on rootfile");
  }

  return fullPath;
}
