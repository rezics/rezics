import type { DatabaseTransaction } from "../database";
import { seedOfficialRuleRealmInTransaction } from "./official-rule-realm/service";

export const PlatformInfrastructureSeedKeys = ["official-rule-realm"] as const;
export type PlatformInfrastructureSeedKey = (typeof PlatformInfrastructureSeedKeys)[number];

interface PlatformInfrastructureSeeder {
	readonly key: PlatformInfrastructureSeedKey;
	readonly seed: (tx: DatabaseTransaction) => Promise<void>;
}

const PlatformInfrastructureSeeders = [
	{
		key: "official-rule-realm",
		seed: async (tx) => {
			await seedOfficialRuleRealmInTransaction(tx, { whenSeeded: "skip" });
		},
	},
] as const satisfies readonly PlatformInfrastructureSeeder[];

/**
 * Builds local/CI platform infrastructure needed by disposable Fixtures.
 * Production never calls this registry; its platform data evolves through APIs.
 */
export async function seedPlatformInfrastructure(tx: DatabaseTransaction): Promise<void> {
	for (const seeder of PlatformInfrastructureSeeders) {
		console.info(`Seeding platform infrastructure: ${seeder.key}`);
		await seeder.seed(tx);
	}
}
