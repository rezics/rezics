import mdx from "@mdx-js/rollup";
import type { Plugin } from "vite";

/** Compile Markdown as React while leaving Vite resource queries such as `?raw` intact. */
export function markdownPlugin(): Plugin {
	const plugin = mdx() as Plugin;
	const transform = plugin.transform;
	if (typeof transform !== "function") throw new Error("Unexpected MDX transform hook");

	return {
		...plugin,
		transform(code, id, options) {
			if (id.includes("?raw")) return null;
			return transform.call(this, code, id, options);
		},
	};
}
