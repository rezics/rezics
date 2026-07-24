import { database } from "../src/services/database";
import { parseSeedRunOptions } from "../src/services/seed/contracts";
import { verifySeedDatabase } from "../src/services/seed/verification";

try {
	const options = parseSeedRunOptions(process.argv.slice(2));
	console.info("Database Seed service is ready.", await verifySeedDatabase(options));
} finally {
	await database.$client.end();
}
