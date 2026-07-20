import Elysia from "elysia";

import { createElysiaObservability } from "../src/elysia.ts";
import { initializeObservability } from "../src/runtime.ts";

const Iterations = 3_000;
const MaximumAverageOverheadMilliseconds = 0.5;
const MaximumHeapGrowthBytes = 64 * 1_024 * 1_024;

function assert(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

interface RequestHandler {
	handle(request: Request): Response | Promise<Response>;
}

async function exercise(app: RequestHandler, iterations: number): Promise<number> {
	const startedAt = performance.now();
	for (let index = 0; index < iterations; index += 1) {
		const response = await app.handle(new Request(`http://localhost/items/${index}`));
		assert(response.status === 200, "Load-smoke request failed");
	}
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	return performance.now() - startedAt;
}

const observability = initializeObservability({
	service: { name: "load-smoke", version: "1.0.0", environment: "production" },
	environmentVariables: {
		OTEL_TRACES_EXPORTER: "none",
		OTEL_METRICS_EXPORTER: "none",
		OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
		OTEL_TRACES_SAMPLER_ARG: "0.1",
	},
	overrides: { logWriter: () => undefined },
});

try {
	const baseline = new Elysia().get("/items/:id", () => "ok");
	const instrumented = new Elysia()
		.use(createElysiaObservability())
		.get("/items/:id", () => "ok");
	await exercise(baseline, 200);
	await exercise(instrumented, 200);
	const heapBefore = process.memoryUsage().heapUsed;
	const baselineDuration = await exercise(baseline, Iterations);
	const instrumentedDuration = await exercise(instrumented, Iterations);
	const heapGrowth = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
	const averageOverhead = (instrumentedDuration - baselineDuration) / Iterations;

	assert(
		averageOverhead <= MaximumAverageOverheadMilliseconds,
		`Average sampled-request overhead ${averageOverhead.toFixed(3)}ms exceeded ${MaximumAverageOverheadMilliseconds}ms`,
	);
	assert(
		heapGrowth <= MaximumHeapGrowthBytes,
		`Heap growth ${heapGrowth} bytes exceeded ${MaximumHeapGrowthBytes} bytes`,
	);
	process.stdout.write(
		`Bun observability load smoke passed: ${averageOverhead.toFixed(3)}ms average overhead, ${heapGrowth} bytes heap growth.\n`,
	);
} finally {
	await observability.shutdown();
}
