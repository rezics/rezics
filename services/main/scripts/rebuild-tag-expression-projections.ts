import { database } from "../src/services/database";
import {
	dispatchTagExpressionProjectionRebuilds,
	enqueueAllTagExpressionProjectionRebuilds,
} from "../src/services/tag-expressions/projection-worker";

const enqueued = await enqueueAllTagExpressionProjectionRebuilds();
let advancedPages = 0;
try {
	while (true) {
		const advanced = await dispatchTagExpressionProjectionRebuilds(32);
		advancedPages += advanced;
		if (advanced === 0) break;
	}
	console.info(
		JSON.stringify({ advancedPages, enqueuedExpressions: enqueued, projection: "tag-expression" }),
	);
} finally {
	await database.$client.end();
}
