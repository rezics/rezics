import { bootstrapDatabase } from "../src/services/bootstrap/service";
import { database } from "../src/services/database";

try {
	const result = await bootstrapDatabase();
	if (result.createdCredentials.length === 0) {
		console.info("Bootstrap is already complete; no credentials were created.");
	} else {
		console.info(
			"Official Profile credentials were created. Store these passwords now; they will not be shown again.",
		);
		for (const credential of result.createdCredentials) {
			console.info(
				`\n${credential.name}\nEmail: ${credential.email}\nPassword: ${credential.password}`,
			);
		}
	}
} finally {
	await database.$client.end();
}
