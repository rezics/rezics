// bookInit.ts
// 初始化 Meilisearch 的 books 索引，并做一次简单查询测试

import { SearchClient } from "../client";

const client = new SearchClient({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY ?? "masterKey",
});

async function main() {
  console.log("Checking Meilisearch health...");
  const healthy = await client.checkHealth();
  if (!healthy) {
    console.error(
      "Meilisearch is not available. 请确认 Meilisearch 已经启动并且环境变量配置正确。",
    );
    process.exit(1);
  }
  console.log("Meilisearch is healthy.");

  console.log('Initializing "books" index settings...');
  await client.initBookIndex();
  console.log("Index settings initialized.");

  console.log("Syncing all books from database to Meilisearch...");
  const { syncAllBooks } = await import("../sync");
  const task = await syncAllBooks(client);
  console.log("Sync task enqueued:", task);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('Running a sample search on "books" index...');
  const result = await client.bookIndex.search("", {
    offset: 0,
    limit: 5,
  });

  console.log("Search result (first 5 hits):");
  console.dir(result, { depth: null });

  console.log("bookInit finished.");
}

main().catch((err) => {
  console.error("bookInit failed with error:", err);
  process.exit(1);
});
