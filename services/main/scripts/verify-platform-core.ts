import { assertPlatformCoreReady, inspectPlatformCore } from "../src/services/bootstrap/core";
import { database } from "../src/services/database";

try {
	assertPlatformCoreReady(await inspectPlatformCore());
	console.info("Platform core identities are ready.");
} finally {
	await database.$client.end();
}
