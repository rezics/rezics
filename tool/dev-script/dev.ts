import path from 'path';
import {compileLayout, LayoutCompileError} from './layout-resolver';

const SCRIPT_DIR = path.dirname(Bun.main);
const TOOL_DIR = path.resolve(SCRIPT_DIR, '..');
const ROOT_DIR = path.resolve(TOOL_DIR, '..');

const platform = process.platform;

function commandExists(cmd: string): boolean {
  const result = Bun.spawnSync(['which', cmd], { stdout: 'pipe', stderr: 'pipe' });
  return result.exitCode === 0;
}

if (platform === 'win32') {
  const script = path.join(TOOL_DIR, 'dev-script', 'dev-tmux.ps1');

  if (!commandExists('pwsh')) {
    console.error('Error: pwsh (PowerShell) is not installed.');
    console.error('Install it from: https://github.com/PowerShell/PowerShell');
    process.exit(1);
  }

  const proc = Bun.spawn(['pwsh', '-File', script], {
    cwd: ROOT_DIR,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  await proc.exited;
} else {
  const layout = path.join(TOOL_DIR, 'dev-script', 'layouts', 'dev.kdl');
  const sessionName = 'rezics-dev';

  if (!commandExists('zellij')) {
    console.error('Error: zellij is not installed.');
    if (platform === 'linux') {
      console.error('Install it with: dnf install zellij  (or cargo install zellij)');
    } else if (platform === 'darwin') {
      console.error('Install it with: brew install zellij  (or cargo install zellij)');
    }
    process.exit(1);
  }

  let compiledLayoutPath: string | undefined;
  let cleanup: (() => Promise<void>) | undefined;

  try {
    const compiledLayout = await compileLayout(layout);
    compiledLayoutPath = compiledLayout.compiledLayoutPath;
    cleanup = compiledLayout.cleanup;

    const proc = Bun.spawn(
      [
        'zellij',
        'attach',
        '--create',
        sessionName,
        'options',
        '--default-cwd',
        ROOT_DIR,
        '--default-layout',
        compiledLayoutPath,
      ],
      {
        cwd: ROOT_DIR,
        stdio: ['inherit', 'inherit', 'inherit'],
      },
    );
    await proc.exited;
  } catch (error) {
    if (error instanceof LayoutCompileError) {
      console.error(error.message);
      process.exit(1);
    }

    throw error;
  } finally {
    await cleanup?.();
  }
}
