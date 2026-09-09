import { adapterOas } from "@kubb/adapter-oas";
import { pluginFetch } from "@kubb/plugin-fetch";
import { pluginTs } from "@kubb/plugin-ts";
import { defineConfig } from "kubb/config";

export default defineConfig({
	input: "../openapi/openapi.json",
	adapter: adapterOas({ unknownType: "unknown", emptySchemaType: "void" }),
	output: {
		path: "./src/generated",
		clean: true,
		barrel: false,
		format: "biome",
		lint: false,
	},
	plugins: [
		pluginTs({
			output: { path: "models.ts", mode: "file", barrel: false },
			enum: { type: "asConst", constCasing: "pascalCase", typeSuffix: "" },
			override: [
				{
					type: "schemaName",
					pattern: /^(UnitReferencedBlock|SearchControlExpression|SearchControlPredicate)$/,
					options: {
						enum: {
							type: "inlineLiteral",
							constCasing: "pascalCase",
							typeSuffix: "",
							keyCasing: "none",
						},
					},
				},
			],
		}),
		pluginFetch({ output: { path: "client.ts", mode: "file", barrel: false } }),
	],
});
