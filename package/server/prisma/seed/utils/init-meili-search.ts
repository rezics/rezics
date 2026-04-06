import { searchClient } from "../../../src/meili/search-client";

export async function initMeiliSearch(): Promise<void> {
  console.log("Initializing MeiliSearch indexes...");
  const healthy = await searchClient.checkHealth();
  if (!healthy) {
    throw new Error("MeiliSearch is not available");
  }

  await Promise.all([
    searchClient.initBookIndex(),
    searchClient.initUnitIndex(),
    searchClient.initReadlistIndex(),
    searchClient.initFeedbackIndex(),
    searchClient.initUserIndex(),
  ]);

  console.log("MeiliSearch indexes initialized.");
}

if (import.meta.main) {
  initMeiliSearch().catch((err) => {
    console.error("Failed to initialize MeiliSearch indexes:", err);
    process.exitCode = 1;
  });
}
