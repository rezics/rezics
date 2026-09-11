import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { assertOwnedContainer } from "./config";
import { exec } from "./tools";

/** Capture native crash artifacts only from the exact run-owned PostgreSQL container. @internal */
export async function collectFailureDiagnostics(
	container: string,
	datasetRunId: string,
	output: string,
) {
	const inspection = await exec(
		"docker",
		["inspect", "--format", "{{json .Config.Labels}}", container],
		{ windowsHide: true, timeout: 10_000 },
	);
	assertOwnedContainer(
		container,
		datasetRunId,
		z.record(z.string(), z.string()).parse(JSON.parse(inspection.stdout)),
	);
	const captures = [
		{
			artifact: "postgres.log",
			run: async () => {
				const logs = await exec("docker", ["logs", "--tail", "2000", container], {
					windowsHide: true,
					timeout: 10_000,
					maxBuffer: 16 * 1024 * 1024,
				});
				await writeFile(resolve(output, "postgres.log"), logs.stdout + logs.stderr);
			},
		},
		...(["pgroonga.log", "core"] as const).map((name) => ({
			artifact: name === "core" ? "postgres.core" : name,
			run: async () => {
				if (name === "core") {
					const deadline = Date.now() + 30_000;
					for (;;) {
						const status = await exec(
							"docker",
							[
								"exec",
								container,
								"sh",
								"-c",
								'for status in /proc/[0-9]*/status; do sed -n "/^CoreDumping:/p" "$status" 2>/dev/null; done; true',
							],
							{ windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 },
						);
						if (!/^CoreDumping:/mu.test(status.stdout))
							throw new Error("Kernel core-dump state is unavailable");
						if (!/^CoreDumping:\s*1$/mu.test(status.stdout)) break;
						if (Date.now() >= deadline)
							throw new Error("Native core dump did not finish before capture deadline");
						await setTimeout(250);
					}
				}
				await exec(
					"docker",
					[
						"cp",
						`${container}:/var/lib/postgresql/18/docker/${name}`,
						resolve(output, name === "core" ? "postgres.core" : name),
					],
					{ windowsHide: true, timeout: 60_000 },
				);
			},
		})),
	];
	const results = await Promise.allSettled(captures.map((capture) => capture.run()));
	return results.map((result, index) => ({
		artifact: captures[index]!.artifact,
		status: result.status === "fulfilled" ? ("captured" as const) : ("unavailable" as const),
		...(result.status === "rejected" ? { error: String(result.reason).slice(0, 512) } : {}),
	}));
}
