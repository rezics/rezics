// @eslint-disable
// test-prisma-speed.ts
import 'dotenv/config';

import {PrismaClient} from './prisma/generated/client';

const prisma = new PrismaClient({
  log: [{emit: 'event', level: 'query'}],
});

prisma.$on('query', (e: any) => {
  console.log(`[SQL ${e.duration}ms] ${e.query}`);
});

async function getBookApproxCount() {
  const start = Date.now();

  const result = await prisma.$queryRaw<{estimate: bigint}[]>`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint AS estimate
    FROM pg_class
    WHERE oid = '"Book"'::regclass;
  `;

  const end = Date.now();
  console.log('结果:', result);
  console.log('耗时:', end - start, 'ms');

  return Math.round(Number(result[0]?.estimate ?? 0));
}

(async () => {
  console.log('开始执行近似计数...');
  try {
    const count = await getBookApproxCount();
    console.log(`估算行数: ${count}`);
  } catch (err) {
    console.error('执行失败:', err);
  } finally {
    await prisma.$disconnect();
    console.log('数据库连接已关闭。');
  }
})();
