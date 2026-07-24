import { database } from "../src/services/database";
import { verifySeedSearch } from "../src/services/seed/verification";

try {
	await verifySeedSearch();
	console.info("Official Zone Seed Search contract is ready.");
} finally {
	await database.$client.end();
}
