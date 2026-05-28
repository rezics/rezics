import { join } from "node:path";
import { REPO_ROOT, isExemptPackage, isExemptPath } from "./paths";
import type { ScanContext } from "./types";
import {
  getStagedFilePaths,
  walkDirectories,
  walkFilesByExtension,
} from "./walk";

const ANY_SCANNABLE = /\.(tsx?|jsx?|mdx|css)$/;

export function collectContext({ staged }: { staged: boolean }): ScanContext {
  const packagesRoot = join(REPO_ROOT, "package");
  const inputFiles = staged
    ? getStagedFilePaths()
    : [...walkFilesByExtension(packagesRoot, ANY_SCANNABLE)];

  const apiFiles: string[] = [];
  const tsxFiles: string[] = [];
  const tsAndTsxFiles: string[] = [];
  const r9CandidateFiles: string[] = [];

  for (const filePath of inputFiles) {
    if (isExemptPath(filePath)) continue;
    if (filePath.endsWith(".api.ts") && !isExemptPackage(filePath)) {
      apiFiles.push(filePath);
    }
    if (filePath.endsWith(".tsx")) {
      tsxFiles.push(filePath);
    }
    if (/\.(ts|tsx)$/.test(filePath)) {
      tsAndTsxFiles.push(filePath);
    }
    if (ANY_SCANNABLE.test(filePath)) {
      r9CandidateFiles.push(filePath);
    }
  }

  const folderPaths: string[] = [];
  if (staged) {
    const affected = new Set<string>();
    for (const filePath of inputFiles) {
      const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
      affected.add(parentDir);
      for (const subDir of walkDirectories(parentDir)) affected.add(subDir);
    }
    folderPaths.push(...affected);
  } else {
    folderPaths.push(...walkDirectories(packagesRoot));
  }

  return { apiFiles, tsxFiles, tsAndTsxFiles, r9CandidateFiles, folderPaths };
}
