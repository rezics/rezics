import { platformInstallationService } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	if (!(await platformInstallationService.isInitialBundleReady()))
		throw new Error("Fresh platform installation does not match its factory bundle");
	console.info("Fresh platform installation matches its factory bundle.");
} finally {
	await database.$client.end();
}
