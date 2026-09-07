import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
	BangumiArchiveFamilies,
	readBangumiArchive,
	parseBangumiArchiveRecord,
} from "../src/services/catalog/bangumi-archive";

const { values } = parseArgs({
	options: {
		archive: { type: "string" },
		sha256: { type: "string" },
		output: { type: "string" },
		family: { type: "string" },
	},
	strict: true,
});
const input = z
	.strictObject({
		archive: z.string().min(1),
		sha256: z.string().regex(/^[a-f0-9]{64}$/u),
		output: z.string().min(1).optional(),
		family: z.enum(BangumiArchiveFamilies).optional(),
	})
	.parse(values);
const started = performance.now();
const report = Object.fromEntries(
	BangumiArchiveFamilies.map((family) => [
		family,
		{
			rows: 0,
			accepted: 0,
			rejected: 0,
			maximumRecordBytes: 0,
			danglingReferenceRows: 0,
			errors: [] as { line: number; issues: unknown }[],
		},
	]),
);
for await (const row of readBangumiArchive(resolve(input.archive), {
	sha256: input.sha256,
	family: input.family,
})) {
	const family = report[row.family];
	if (!family) throw new Error("Archive family was not declared");
	family.rows++;
	family.maximumRecordBytes = Math.max(family.maximumRecordBytes, row.bytes.byteLength);
	try {
		const parsed = parseBangumiArchiveRecord(row.family, row.bytes);
		if (
			parsed.record &&
			"kind" in parsed.record &&
			parsed.record.kind === "person-relations" &&
			(parsed.record.person_id === 0 || parsed.record.related_person_id === 0)
		)
			family.danglingReferenceRows++;
		family.accepted++;
	} catch (error) {
		family.rejected++;
		if (family.errors.length < 8)
			family.errors.push({
				line: row.line,
				issues:
					error instanceof z.ZodError
						? error.issues.slice(0, 8).map(({ code, path, message }) => ({ code, path, message }))
						: error instanceof Error
							? error.message.slice(0, 1024)
							: "Unknown parsing failure",
			});
	}
}
const result = {
	archiveSha256: input.sha256,
	scope: input.family ?? "all",
	nativeCoverageQualified: false,
	elapsedSeconds: (performance.now() - started) / 1000,
	families: report,
};
if (input.output) await writeFile(resolve(input.output), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (Object.values(report).some((family) => family.rejected !== 0)) process.exitCode = 1;
