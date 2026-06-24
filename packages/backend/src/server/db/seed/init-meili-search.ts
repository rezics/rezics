import type { SearchClient } from "@rezics/search/client";

export async function ensureMeiliIndexes(
  searchClient: SearchClient,
): Promise<void> {
  console.log("Initializing MeiliSearch indexes...");
  const healthy = await searchClient.checkHealth();
  if (!healthy) {
    throw new Error("MeiliSearch is not available");
  }

  await Promise.all([
    searchClient.initContentIndex(),
    searchClient.initFeedbackIndex(),
    searchClient.initUserIndex(),
    searchClient.initPostIndex(),
    searchClient.initRealmIndex(),
    searchClient.initZoneIndex(),
    searchClient.initTagIndex(),
    searchClient.initLabelIndex(),
    searchClient.initEntityIndex(),
    searchClient.initProgressIndex(),
    searchClient.initCommentIndex(),
    searchClient.initPollIndex(),
    searchClient.initShelfItemIndex(),
  ]);

  console.log("MeiliSearch indexes initialized.");
}

export async function resetMeiliIndexes(
  searchClient: SearchClient,
): Promise<void> {
  console.log("Resetting existing MeiliSearch indexes...");
  const healthy = await searchClient.checkHealth();
  if (!healthy) {
    throw new Error("MeiliSearch is not available");
  }
  await searchClient.resetKnownIndexes();
  await ensureMeiliIndexes(searchClient);
}

export const initMeiliSearch = ensureMeiliIndexes;
