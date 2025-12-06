//  这玩意目前还用不了，wsl启动有问题，太复杂了，整不明白 :(

import {spawn} from 'child_process';
import path from 'path';

const ROOT = `D:/ICS/Library.Book/Library.Book`;
const ROOT_WSL = `/mnt/d/ICS/Library.Book/Library.Book`;

function spawnService(name: string, cmd: string, args: string[], cwd?: string) {
  const p = spawn(cmd, args, {
    cwd,
    shell: true,
    detached: false, // 不创建新窗口
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  p.stdout.on('data', data => {
    process.stdout.write(`\n[${name}] ${data}`);
  });

  p.stderr.on('data', data => {
    process.stderr.write(`\n[${name} ERROR] ${data}`);
  });

  p.on('close', code => {
    console.log(`\n⚠ ${name} stopped: exit code ${code}`);
  });

  return p;
}

console.log('\n🚀 Starting Dev Environment...\n');

spawnService('Postgres', 'pg_ctl', ['start']);

spawn(
  'C:\\Windows\\System32\\wsl.exe',
  ['bash', '-lc', `cd ${ROOT_WSL}/package/search && bun run meilisearch:wsl`],
  {
    stdio: 'pipe',
    windowsHide: true,
    shell: false, // 禁用shell，避免cmd参与参数解析
  },
);

spawnService('Frontend', 'bun', ['run', 'dev'], `${ROOT}/package/app`);

spawnService('Backend', 'bun', ['run', 'dev'], `${ROOT}/package/server-elysia`);

console.log('✨ All services started. Live logs streaming below ↓');
