/** Read-only adapter to the production emitter; never writes generated schema. */
import { storageModules } from "../../../libraries/schema/model/storage";
import { emitDrizzle } from "../../../libraries/schema-importer/src/compiler/drizzle";

process.stdout.write(
	JSON.stringify(
		storageModules.map((module) => ({
			path: `libraries/schema/${module.output}`,
			content: emitDrizzle(module),
		})),
	),
);
