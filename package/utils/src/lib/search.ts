import { SearchClient } from "@rezics/search/client";

export function createSeedSearchClient(input: {
  host: string;
  apiKey: string;
}): SearchClient {
  return new SearchClient(input);
}
