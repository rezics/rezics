import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const IMPORT_LINE_PATTERN = /^(\s*)import\s+(["'])(.+?)\2\s*$/;
const PATH_ATTRIBUTE_PATTERN = /\b(cwd|path|file|layout|command|edit)\s*=\s*(["'])(.+?)\2/g;
const FILE_LOCATION_PATTERN = /\blocation\s*=\s*(["'])file:(.+?)\1/g;

type SourceLocation = {
  filePath: string;
  line: number;
  column: number;
};

export class LayoutCompileError extends Error {
  readonly location: SourceLocation;

  constructor(message: string, location: SourceLocation) {
    super(`${message}\n  at ${location.filePath}:${location.line}:${location.column}`);
    this.name = 'LayoutCompileError';
    this.location = location;
  }
}

type CompileContext = {
  visited: Set<string>;
};

function isExplicitRelativePath(value: string): boolean {
  return value.startsWith('./') || value.startsWith('../');
}

function normalizePathForLayout(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

function resolvePathAttributes(line: string, baseDir: string): string {
  const withResolvedAttributes = line.replace(PATH_ATTRIBUTE_PATTERN, (match, key, quote, rawValue) => {
    if (!isExplicitRelativePath(rawValue)) {
      return match;
    }

    const resolvedValue = normalizePathForLayout(path.resolve(baseDir, rawValue));
    return `${key}=${quote}${resolvedValue}${quote}`;
  });

  return withResolvedAttributes.replace(FILE_LOCATION_PATTERN, (match, quote, rawValue) => {
    if (!isExplicitRelativePath(rawValue)) {
      return match;
    }

    const resolvedValue = normalizePathForLayout(path.resolve(baseDir, rawValue));
    return `location=${quote}file:${resolvedValue}${quote}`;
  });
}

async function compileFile(filePath: string, context: CompileContext): Promise<string[]> {
  const absolutePath = path.resolve(filePath);

  if (context.visited.has(absolutePath)) {
    throw new LayoutCompileError('Circular layout import detected', {
      filePath: absolutePath,
      line: 1,
      column: 1,
    });
  }

  context.visited.add(absolutePath);

  try {
    const content = await readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const compiledLines: string[] = [];
    const baseDir = path.dirname(absolutePath);

    for (const [index, line] of lines.entries()) {
      const importMatch = line.match(IMPORT_LINE_PATTERN);

      if (!importMatch) {
        compiledLines.push(resolvePathAttributes(line, baseDir));
        continue;
      }

      const [, indentation, , importTarget] = importMatch;
      const importedPath = path.resolve(baseDir, importTarget);

      try {
        const importedLines = await compileFile(importedPath, context);
        compiledLines.push(
          ...importedLines.map(importedLine =>
            importedLine.length > 0 ? `${indentation}${importedLine}` : importedLine,
          ),
        );
      } catch (error) {
        if (error instanceof LayoutCompileError) {
          throw error;
        }

        const location = {
          filePath: absolutePath,
          line: index + 1,
          column: line.indexOf(importTarget) + 1,
        };
        const message =
          error instanceof Error
            ? `Failed to import layout resource "${importTarget}": ${error.message}`
            : `Failed to import layout resource "${importTarget}"`;

        throw new LayoutCompileError(message, location);
      }
    }

    return compiledLines;
  } finally {
    context.visited.delete(absolutePath);
  }
}

export async function compileLayout(layoutPath: string): Promise<{
  compiledLayoutPath: string;
  cleanup: () => Promise<void>;
}> {
  const compiledLines = await compileFile(layoutPath, {visited: new Set()});
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rezics-layout-'));
  const compiledLayoutPath = path.join(tempDir, path.basename(layoutPath));

  await writeFile(compiledLayoutPath, compiledLines.join('\n'));

  return {
    compiledLayoutPath,
    cleanup: async () => {
      await rm(tempDir, {recursive: true, force: true});
    },
  };
}
