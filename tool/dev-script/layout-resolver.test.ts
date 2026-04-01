import {afterEach, describe, expect, test} from 'bun:test';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LayoutCompileError, compileLayout} from './layout-resolver';

const tempDirs = new Set<string>();

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'rezics-layout-test-'));
  tempDirs.add(tempDir);
  return tempDir;
}

afterEach(async () => {
  for (const tempDir of tempDirs) {
    await rm(tempDir, {recursive: true, force: true});
  }
  tempDirs.clear();
});

describe('compileLayout', () => {
  test('resolves imported files relative to the importing layout', async () => {
    const tempDir = await createTempDir();
    const entryLayout = path.join(tempDir, 'main.kdl');
    const partialDir = path.join(tempDir, 'layouts');
    const partialLayout = path.join(partialDir, 'backend.kdl');

    await mkdir(partialDir, {recursive: true});
    await Bun.write(
      entryLayout,
      ['layout {', '  import "./layouts/backend.kdl"', '}'].join('\n'),
    );
    await writeFile(
      partialLayout,
      [
        'tab name="backend" {',
        '  pane split_direction="vertical" {',
        '    pane command="bun" cwd="./auth" {',
        '      args "dev"',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );

    const {compiledLayoutPath, cleanup} = await compileLayout(entryLayout);
    const compiled = await readFile(compiledLayoutPath, 'utf8');

    expect(compiled).toContain(
      `cwd="${path.join(partialDir, 'auth').split(path.sep).join(path.posix.sep)}"`,
    );

    await cleanup();
  });

  test('reports the importer location when an imported resource is missing', async () => {
    const tempDir = await createTempDir();
    const entryLayout = path.join(tempDir, 'main.kdl');

    await Bun.write(
      entryLayout,
      ['layout {', '  import "./missing/backend.kdl"', '}'].join('\n'),
    );

    await expect(compileLayout(entryLayout)).rejects.toMatchObject<LayoutCompileError>({
      name: 'LayoutCompileError',
      location: {
        filePath: entryLayout,
        line: 2,
        column: 11,
      },
    });
  });

  test('resolves explicit relative command resources from imported layouts', async () => {
    const tempDir = await createTempDir();
    const entryLayout = path.join(tempDir, 'main.kdl');
    const partialDir = path.join(tempDir, 'layouts');
    const partialLayout = path.join(partialDir, 'script-pane.kdl');

    await mkdir(partialDir, {recursive: true});
    await Bun.write(
      entryLayout,
      ['layout {', '  import "./layouts/script-pane.kdl"', '}'].join('\n'),
    );
    await writeFile(
      partialLayout,
      [
        'tab name="scripts" {',
        '  pane command="./run-dev.sh" cwd="./workspace" {}',
        '}',
      ].join('\n'),
    );

    const {compiledLayoutPath, cleanup} = await compileLayout(entryLayout);
    const compiled = await readFile(compiledLayoutPath, 'utf8');

    expect(compiled).toContain(
      `command="${path.join(partialDir, 'run-dev.sh').split(path.sep).join(path.posix.sep)}"`,
    );
    expect(compiled).toContain(
      `cwd="${path.join(partialDir, 'workspace').split(path.sep).join(path.posix.sep)}"`,
    );

    await cleanup();
  });
});
