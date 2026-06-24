import { SearchClient } from "../../search/client";
import { env } from "../env";

export const searchClient = new SearchClient({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
});
