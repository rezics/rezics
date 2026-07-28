import { adapterOas } from "@kubb/adapter-oas";
import { pluginFetch } from "@kubb/plugin-fetch";
import { pluginTs } from "@kubb/plugin-ts";
import { defineConfig } from "kubb/config";

const FirstPartyOnlyOperation = {
	type: "operationId",
	pattern: "assignCurrentProfileSlug",
} as const;

export default defineConfig({
	input: "../../libraries/services/main/openapi/openapi.json",
	adapter: adapterOas({ unknownType: "unknown", emptySchemaType: "void" }),
	output: {
		path: "./src/generated",
		clean: true,
		barrel: false,
		format: "prettier",
		lint: false,
	},
	plugins: [
		pluginTs({
			output: { path: "models.ts", mode: "file", barrel: false },
			enum: { type: "asConst", constCasing: "pascalCase", typeSuffix: "" },
			exclude: [FirstPartyOnlyOperation],
		}),
		pluginFetch({
			output: { path: "client.ts", mode: "file", barrel: false },
			exclude: [FirstPartyOnlyOperation],
		}),
	],
});
