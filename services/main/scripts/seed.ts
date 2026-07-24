import { database } from "../src/services/database";
import { parseSeedRunOptions } from "../src/services/seed/contracts";
import { databaseSeedService } from "../src/services/seed/service";

try {
	await databaseSeedService.run(parseSeedRunOptions(process.argv.slice(2)));
} finally {
	await database.$client.end();
}
