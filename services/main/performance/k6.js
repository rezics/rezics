import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const manifest = JSON.parse(open(__ENV.REZICS_PERF_MANIFEST));
const cases = new SharedArray("relationship queries", () => manifest.cases);
const journeyTime = new Trend("query_journey_ms", true);
const pageTime = new Trend("query_page_ms", true);
const queryErrors = new Rate("query_errors");
const underfilled = new Rate("query_underfilled");
const cursorCycles = new Rate("query_cursor_cycles");
const pages = new Counter("query_pages");
const completed = new Counter("query_cases");
const results = new Counter("query_results");
const thresholds = {
	query_errors: ["rate==0"],
	query_cursor_cycles: ["rate==0"],
	dropped_iterations: ["count==0"],
};
for (const item of cases) {
	thresholds[`query_cases{case:${item.id}}`] = [manifest.mode === "load" ? "count>=20" : "count>0"];
	if (manifest.mode === "load")
		thresholds[`query_journey_ms{case:${item.id}}`] = [
			`p(95)<${manifest.budgets.journeyP95Ms}`,
			`p(99)<${manifest.budgets.journeyP99Ms}`,
		];
}
if (manifest.mode === "load") {
	thresholds.query_journey_ms = [
		`p(95)<${manifest.budgets.journeyP95Ms}`,
		`p(99)<${manifest.budgets.journeyP99Ms}`,
	];
}
export const options = {
	scenarios:
		manifest.mode === "smoke"
			? {
					queries: {
						executor: "shared-iterations",
						vus: 1,
						iterations: cases.length,
						maxDuration: "15m",
					},
				}
			: {
					queries: {
						executor: "constant-arrival-rate",
						rate: manifest.rate,
						timeUnit: "1s",
						duration: `${manifest.durationSeconds}s`,
						preAllocatedVUs: manifest.vus,
						maxVUs: manifest.vus,
					},
				},
	thresholds,
	summaryTrendStats: ["min", "med", "p(95)", "p(99)", "max"],
};

export default function () {
	const item = cases[exec.scenario.iterationInTest % cases.length];
	const tags = { case: item.id, shape: item.shape, bucket: item.bucket, depth: String(item.pages) };
	const started = Date.now();
	let body = JSON.parse(JSON.stringify(item.body));
	const cursors = new Set();
	let failed = false;
	for (let page = 0; page < item.pages; page++) {
		const response = http.post(`${__ENV.REZICS_PERF_URL}${item.path}`, JSON.stringify(body), {
			headers: { "Content-Type": "application/json" },
			tags,
			timeout: "35s",
		});
		pageTime.add(response.timings.duration, tags);
		let data;
		try {
			data = response.json();
		} catch {
			data = undefined;
		}
		const valid =
			response.status === 200 && data && (Array.isArray(data.groups) || Array.isArray(data.items));
		check(response, { "query returns a result envelope": () => Boolean(valid) }, tags);
		queryErrors.add(!valid, tags);
		pages.add(1, tags);
		if (!valid) {
			failed = true;
			break;
		}
		const count =
			data.items?.length ?? data.groups.reduce((sum, group) => sum + (group.hits?.length ?? 0), 0);
		results.add(count, tags);
		underfilled.add(Boolean(data.nextCursor) && count < item.body.state.pageSize, tags);
		const cyclic = data.nextCursor && cursors.has(data.nextCursor);
		cursorCycles.add(Boolean(cyclic), tags);
		if (cyclic) {
			failed = true;
			break;
		}
		if (!data.nextCursor) break;
		cursors.add(data.nextCursor);
		body.state.cursor = data.nextCursor;
	}
	if (!failed) completed.add(1, tags);
	journeyTime.add(Date.now() - started, tags);
}

export function handleSummary(data) {
	return { [__ENV.REZICS_PERF_SUMMARY]: JSON.stringify(data, null, 2) };
}
