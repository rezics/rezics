import { setSearchDb, syncAllContainedUnitIds } from "@rezics/search";
import { db, disconnectServerDb } from "../db/client";
import { searchClient } from "../meili/search-client";

try {
  setSearchDb(db);
  const result = await syncAllContainedUnitIds(searchClient);
  console.log(result);
} finally {
  await disconnectServerDb();
}
