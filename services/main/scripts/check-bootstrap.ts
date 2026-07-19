import { isBootstrapReady } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	if (!(await isBootstrapReady())) {
		throw new Error(
			"Database bootstrap is incomplete; run `yarn task local:setup` before development",
		);
	}
	console.info("Database bootstrap is ready.");
} finally {
	await database.$client.end();
}
