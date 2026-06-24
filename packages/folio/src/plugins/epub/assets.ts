import type { FileMap } from "./zip";

const ASSET_ATTR_REGEX = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

export interface AssetTracker {
  blobUrls: string[];
  revoke: () => void;
}

export function createAssetTracker(): AssetTracker {
  const blobUrls: string[] = [];
  return {
    blobUrls,
    revoke() {
      for (const url of blobUrls) {
        URL.revokeObjectURL(url);
      }
      blobUrls.length = 0;
    },
  };
}

function resolveRelativePath(basePath: string, relative: string): string {
  // Remove the file name from basePath to get directory
  // 从 basePath 中去掉文件名以得到目录
  const dir = basePath.includes("/")
    ? basePath.slice(0, basePath.lastIndexOf("/") + 1)
    : "";

  const parts = (dir + relative).split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    css: "text/css",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

export function resolveAssets(
  html: string,
  chapterPath: string,
  fileMap: FileMap,
  tracker: AssetTracker,
): string {
  return html.replace(ASSET_ATTR_REGEX, (match, relativePath: string) => {
    // Skip external URLs and data URIs
    // 跳过外部 URL 和 data URI
    if (
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://") ||
      relativePath.startsWith("data:")
    ) {
      return match;
    }

    const resolvedPath = resolveRelativePath(chapterPath, relativePath);
    const data = fileMap.get(resolvedPath);

    if (!data) {
      // Asset not found — leave reference unchanged
      // 未找到资源——保持引用不变
      return match;
    }

    const blob = new Blob([data.buffer as ArrayBuffer], {
      type: getMimeType(resolvedPath),
    });
    const blobUrl = URL.createObjectURL(blob);
    tracker.blobUrls.push(blobUrl);

    // Replace the relative path with the blob URL
    // 用 blob URL 替换相对路径
    const attr = match.startsWith("src") ? "src" : "href";
    return `${attr}="${blobUrl}"`;
  });
}
