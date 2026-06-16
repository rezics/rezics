// Initialize the Meilisearch content index and run a sample search.
// 初始化 Meilisearch 的 content 索引并运行一次示例搜索。

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
      "Meilisearch is not available. Ensure it is running and environment variables are correct.",
    );
    process.exit(1);
  }
  console.log("Meilisearch is healthy.");

  console.log('Initializing "content" index settings...');
  await client.initContentIndex();
  console.log("Index settings initialized.");

  console.log("Syncing all content from database to Meilisearch...");
  const { syncAllContent } = await import("../sync");
  const task = await syncAllContent(client);
  console.log("Sync result:", task);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('Running a sample search on "content" index...');
  const result = await client.contentIndex.search("", {
    offset: 0,
    limit: 5,
  });

  console.log("Search result (first 5 hits):");
  console.dir(result, { depth: null });

  console.log("contentInit finished.");
}

main().catch((err) => {
  console.error("contentInit failed with error:", err);
  process.exit(1);
});
