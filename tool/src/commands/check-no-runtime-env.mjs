import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const packageDir = join(rootDir, "packages");
const forbiddenPatterns = [/process\.env/g, /import\.meta\.env/g];

function shouldSkipFile(relativePath) {
  return (
    !relativePath.includes(`${join("src", "")}`) ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(".test.js") ||
    relativePath.endsWith(".test.jsx") ||
    relativePath.endsWith(`${join("env.ts")}`) ||
    relativePath.endsWith("vite.config.ts") ||
    relativePath.endsWith("vite.config.js") ||
    relativePath.endsWith("vite.config.mjs") ||
    relativePath.endsWith("vite.config.cjs") ||
    relativePath.endsWith("TODO.md")
  );
}

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === "node_modules") {
        continue;
      }
      collectFiles(fullPath, files);
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const violations = [];

for (const fullPath of collectFiles(packageDir)) {
  const relativePath = relative(rootDir, fullPath);
  if (shouldSkipFile(relativePath)) {
    continue;
  }

  const content = readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      return;
    }

    if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${relativePath}:${index + 1}:${line.trim()}`);
    }
  });
}

if (violations.length === 0) {
  process.exit(0);
}

process.stderr.write(
  "Direct runtime env usage is not allowed outside package env modules.\n",
);
process.stderr.write(`${violations.join("\n")}\n`);
process.exit(1);
