/**
 * install-services.ts
 *
 * 批量安装多个 systemd 服务文件到 /etc/systemd/system/
 * 然后执行 daemon-reload / enable / start
 * 可在 Node / Bun 环境运行
 */

import {execSync} from 'node:child_process';
import {existsSync, chmodSync} from 'node:fs';

// ======== 配置区：你可以随便改 ========

interface ServiceConfig {
  /** systemd 服务文件名，例如 `meilisearch.service` */
  name: string;

  /** 源文件路径 */
  src: string;

  /** 是否启用开机自启 */
  enable?: boolean;

  /** 是否启动服务 */
  start?: boolean;
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'rezbooklib.service',
    src: './rezbooklib.service',
    enable: true,
    start: true,
  },
  // 你可以继续添加……
];

const SYSTEMD_DIR = '/etc/systemd/system';

// 是否遇到错误时报错退出
const EXIT_ON_ERROR = false;

// ======== 封装执行命令 ========

function sh(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {stdio: 'inherit'});
}

// ======== 单服务处理函数 ========

function installOneService(config: ServiceConfig) {
  const dest = `${SYSTEMD_DIR}/${config.name}`;

  console.log(`\n==============================`);
  console.log(`▶ 处理服务: ${config.name}`);
  console.log(`==============================\n`);

  if (!existsSync(config.src)) {
    const msg = `❌ 源文件不存在: ${config.src}`;
    if (EXIT_ON_ERROR) throw new Error(msg);
    console.error(msg);
    return;
  }

  try {
    console.log(`复制 ${config.src} -> ${dest}`);
    sh(`sudo cp "${config.src}" "${dest}"`);

    console.log('设置权限 644');
    chmodSync(dest, 0o644);

    console.log('执行 daemon-reload');
    sh('sudo systemctl daemon-reload');

    if (config.enable) {
      console.log('启用开机自启');
      sh(`sudo systemctl enable ${config.name}`);
    }

    if (config.start) {
      console.log('启动服务');
      sh(`sudo systemctl start ${config.name}`);
    }

    console.log('查看服务状态');
    sh(`sudo systemctl status ${config.name} --no-pager`);
  } catch (err) {
    console.error(`🚨 安装 ${config.name} 失败:`);
    console.error(err);

    if (EXIT_ON_ERROR) process.exit(1);
  }
}

// ======== 主逻辑：依次执行 ========

function main() {
  console.log('==== 批量安装 systemd 服务 ====\n');

  SERVICES.forEach(service => {
    installOneService(service);
  });

  console.log('\n🚀 完成：所有服务已处理完毕');
}

main();
