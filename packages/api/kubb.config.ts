import { adapterOas } from "@kubb/adapter-oas";
import { pluginFetch } from "@kubb/plugin-fetch";
import { pluginTs } from "@kubb/plugin-ts";
import { defineConfig } from "kubb/config";

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
		}),
		pluginFetch({ output: { path: "client.ts", mode: "file", barrel: false } }),
	],
});
