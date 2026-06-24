import { join, relative } from "node:path";
import { isExemptPackage, isExemptPath, REPO_ROOT } from "./paths";
import type { ScanContext } from "./types";
import {
  getStagedFilePaths,
  walkDirectories,
  walkFilesByExtension,
} from "./walk";

const ANY_SCANNABLE = /\.(tsx?|jsx?|mdx|css)$/;

export function collectContext({ staged }: { staged: boolean }): ScanContext {
  const packagesRoot = join(REPO_ROOT, "packages");
  const inputFiles = staged
    ? getStagedFilePaths()
    : [...walkFilesByExtension(packagesRoot, ANY_SCANNABLE)];

  const apiFiles: string[] = [];
  const tsxFiles: string[] = [];
  const tsAndTsxFiles: string[] = [];
  const schemaFiles: string[] = [];
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
    if (
      /^packages\/(server|auth)\/src\/db\/schema\/.*\.ts$/.test(
        toRel(filePath),
      )
    ) {
      schemaFiles.push(filePath);
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

  return {
    apiFiles,
    tsxFiles,
    tsAndTsxFiles,
    schemaFiles,
    r9CandidateFiles,
    folderPaths,
  };
}

function toRel(filePath: string): string {
  return relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}
