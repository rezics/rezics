// bookInit.ts
// 初始化 Meilisearch 的 books 索引，并做一次简单查询测试

import {checkMeiliHealth} from '../client';
import {initBookIndex} from '../meili_index';
import {syncAllBooks} from '../sync';
import {searchBooks} from '../search';

async function main() {
  console.log('Checking Meilisearch health...');
  const healthy = await checkMeiliHealth();
  if (!healthy) {
    console.error(
      'Meilisearch is not available. 请确认 Meilisearch 已经启动并且环境变量配置正确。',
    );
    process.exit(1);
  }
  console.log('Meilisearch is healthy.');

  console.log('Initializing "books" index settings...');
  await initBookIndex();
  console.log('Index settings initialized.');

  console.log('Syncing all books from database to Meilisearch...');
  const task = await syncAllBooks();
  console.log('Sync task enqueued:', task);

  // 如果需要，可以在这里简单等待一会儿让任务完成，或者在真实环境中轮询任务状态
  // 这里简单等待 2 秒
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Running a sample search on "books" index...');
  const result = await searchBooks({
    q: '',
    page: 1,
    limit: 5,
  });

  console.log('Search result (first 5 hits):');
  console.dir(result, {depth: null});

  console.log('bookInit finished.');
}

main().catch(err => {
  console.error('bookInit failed with error:', err);
  process.exit(1);
});
