import type { SearchClient } from "@rezics/search/client";

export interface InitMeiliSearchOptions {
  clean?: boolean;
}

export async function initMeiliSearch(
  searchClient: SearchClient,
  options: InitMeiliSearchOptions = {},
): Promise<void> {
  console.log("Initializing MeiliSearch indexes...");
  const healthy = await searchClient.checkHealth();
  if (!healthy) {
    throw new Error("MeiliSearch is not available");
  }

  if (options.clean) {
    console.log("Resetting existing MeiliSearch indexes...");
    await searchClient.resetKnownIndexes();
  }

  await Promise.all([
    searchClient.initContentIndex(),
    searchClient.initFeedbackIndex(),
    searchClient.initUserIndex(),
    searchClient.initPostIndex(),
    searchClient.initRealmIndex(),
    searchClient.initEntityIndex(),
    searchClient.initProgressIndex(),
    searchClient.initCommentIndex(),
    searchClient.initPollIndex(),
    searchClient.initShelfItemIndex(),
  ]);

  console.log("MeiliSearch indexes initialized.");
}
