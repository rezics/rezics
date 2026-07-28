import { describe, expect, it } from "vitest";

import { ProgressImportHeaders, parseProgressImportCsv } from "./progress-import";

const UnitId = "018f3f86-7541-7b0f-90d1-8d9d9ba938ca";

describe("progress import CSV", () => {
	it("parses a historical completion", () => {
		const result = parseProgressImportCsv(
			[
				ProgressImportHeaders.join(","),
				`${UnitId},completion,active,0.3,2024-02-01,day,0,external-1,false,`,
			].join("\n"),
		);
		expect(result).toMatchObject({
			kind: "success",
			items: [
				{
					entryKind: "completion",
					status: "completed",
					progress: 1,
					occurredAt: "2024-02-01T00:00:00.000Z",
				},
			],
		});
	});

	it("reports the first invalid row", () => {
		const result = parseProgressImportCsv(
			[
				ProgressImportHeaders.join(","),
				"not-an-id,update,active,0.2,2024,year,0,,false,",
			].join("\n"),
		);
		expect(result).toEqual({ kind: "failure", line: 2 });
	});
});
