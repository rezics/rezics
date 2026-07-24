import { isNotNull } from "drizzle-orm";

import { syncUnitLocalizationContentMetrics } from "../src/services/content-metrics/service";
import { database } from "../src/services/database";
import { unitLocalization, unitLocalizationContentMetric } from "../src/services/database/schema";

const BatchSize = 100;

try {
	const [localizedUnits, projectedUnits] = await Promise.all([
		database
			.selectDistinct({ unitId: unitLocalization.unitId })
			.from(unitLocalization)
			.where(isNotNull(unitLocalization.content)),
		database
			.selectDistinct({ unitId: unitLocalizationContentMetric.unitId })
			.from(unitLocalizationContentMetric),
	]);
	const unitIds = [
		...new Set([
			...localizedUnits.map(({ unitId }) => unitId),
			...projectedUnits.map(({ unitId }) => unitId),
		]),
	].sort();

	for (let offset = 0; offset < unitIds.length; offset += BatchSize) {
		const batch = unitIds.slice(offset, offset + BatchSize);
		await database.transaction(async (tx) => {
			for (const unitId of batch) await syncUnitLocalizationContentMetrics(tx, unitId);
		});
	}
	console.info(`Rebuilt localized content metrics for ${unitIds.length} Units`);
} finally {
	await database.$client.end();
}
