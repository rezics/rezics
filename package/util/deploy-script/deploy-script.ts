/**
 * deployScript.ts
 *
 * 部署流程：
 * 1. 强制从远程更新 GIT
 * 2. app/ → bun run build → dist → 部署到 /www/wwwroot/book.rezics.com
 * 3. server-elysia/ → bun run build:linux → 将 server 复制到 /www/wwwroot/Library.Book/server
 *
 * 使用方式：
 *   bun run deployScript.ts
 * 或 node 18+
 */

import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import {rm, mkdir, cp, readdir} from 'node:fs/promises';
import path, {join} from 'node:path';

const sh = promisify(exec);

async function safeRm(path: string) {
  try {
    await rm(path, {recursive: true, force: true});
  } catch (err) {
    console.error(`Error removing ${path}:`, err);
  }
}

async function clearDir(dir: string) {
  const entries = await readdir(dir, {withFileTypes: true});
  for (const entry of entries) {
    await safeRm(join(dir, entry.name));
  }
}

// 当前脚本所在目录 = /package 下
const SCRIPT_DIR = path.resolve(import.meta.dirname);

// 主目录（含 app/ 与 server-elysia/）
const ROOT = path.resolve(SCRIPT_DIR, '../../');

// git 仓库根目录
const GIT_ROOT = path.resolve(SCRIPT_DIR, '../../../');

// 各项目目录
const APP_DIR = path.join(ROOT, 'app');
const SERVER_DIR = path.join(ROOT, 'server-elysia');

// 部署输出目录
const FRONTEND_TARGET = '/www/wwwroot/book.rezics.com/';
const SERVER_TARGET = '/www/wwwroot/Library.Book/server/';

// 执行命令（打印实时 stdout/stderr）
async function run(cmd: string, cwd?: string) {
  console.log(`\n▶ ${cmd}`);
  const p = exec(cmd, {cwd});
  p.stdout?.pipe(process.stdout);
  p.stderr?.pipe(process.stderr);

  return new Promise((resolve, reject) => {
    p.on('close', code => {
      if (code === 0) resolve(code);
      else reject(new Error(`命令失败: ${cmd}`));
    });
  });
}

async function runIn(dir: string, cmd: string) {
  return run(`cd ${dir} && ${cmd}`);
}

async function deploy() {
  console.log('==============================');
  console.log('Start deploying Library.Book');
  console.log('==============================\n');

  console.log('Directories', {
    ROOT: ROOT,
    SCRIPT_DIR: SCRIPT_DIR,
    GIT_ROOT: GIT_ROOT,
    APP_DIR: APP_DIR,
    SERVER_DIR: SERVER_DIR,
    FRONTEND_TARGET: FRONTEND_TARGET,
    SERVER_TARGET: SERVER_TARGET,
  });

  //
  // 1. Git 同步（强制拉取）
  //
  console.log('\n===== Get latest Git =====');
  await run('git fetch --all', GIT_ROOT);
  await run('git reset --hard origin/dev', GIT_ROOT);

  //
  // 2. 构建前端 App
  //
  console.log('\n===== Build frontend app =====');
  await run('bun install', APP_DIR);
  await runIn(APP_DIR, 'bun run build');

  console.log(`\n>>> Clear directory: ${FRONTEND_TARGET}`);
  await clearDir(FRONTEND_TARGET);

  console.log('>>> Copy dist → deployment directory');
  const distPath = path.join(APP_DIR, 'dist');
  await cp(distPath, FRONTEND_TARGET, {recursive: true});

  //
  // 3. 构建 Elysia 后端
  //
  console.log('\n===== Build backend server-elysia =====');
  await run('bun install', SERVER_DIR);
  await run('bun run prisma:deploy', SERVER_DIR);
  await runIn(SERVER_DIR, 'bun run build:linux');

  console.log(`\n>>> Deploy server → ${SERVER_TARGET}`);
  console.log('Stopping service');
  await run('sudo systemctl stop rezbooklib.service', SERVER_DIR);
  const outputServer = path.join(SERVER_DIR, 'server'); // build:linux 后生成的文件

  await cp(outputServer, path.join(SERVER_TARGET, 'server'), {
    recursive: false,
  });

  await run('sudo systemctl start rezbooklib.service', SERVER_DIR);

  console.log('\n==============================');
  console.log('Deployment complete: frontend + backend updated');
  console.log('==============================\n');
}

deploy().catch(err => {
  console.error('\nDeployment failed:');
  console.error(err);
  process.exit(1);
});
