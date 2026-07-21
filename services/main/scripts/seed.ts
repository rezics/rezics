import { database } from "../src/services/database";
import { seedDatabase } from "../src/services/seed/service";

try {
	await seedDatabase();
} finally {
	await database.$client.end();
}
