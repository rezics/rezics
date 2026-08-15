#!/usr/bin/env node
// @ts-check

import {
	describeWrapperError,
	INTERNAL_WRAPPER_PROBE_EXIT_CODE,
	INTERNAL_WRAPPER_PROBE_MARKER,
	isInternalWrapperProbe,
	runAtlas,
} from "../src/atlas-wrapper.mjs";

if (isInternalWrapperProbe(process.env)) {
	process.stderr.write(`${INTERNAL_WRAPPER_PROBE_MARKER}\n`);
	process.exitCode = INTERNAL_WRAPPER_PROBE_EXIT_CODE;
} else {
	try {
		process.exitCode = await runAtlas(process.argv.slice(2));
	} catch (error) {
		const description = describeWrapperError(error);
		process.stderr.write(`@rezics/atlas: ${description.message}\n`);
		process.exitCode = description.exitCode;
	}
}
