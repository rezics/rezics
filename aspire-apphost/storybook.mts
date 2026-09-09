import { refExpr } from "./.aspire/modules/base.mjs";
import { createBuilder, ProbeType } from "./.aspire/modules/aspire.mjs";

/** Register the isolated component runtimes without application/data dependencies. */
export async function addStorybooks(builder: Awaited<ReturnType<typeof createBuilder>>) {
	async function add(name: string, directory: string) {
		const resource = await builder
			.addJavaScriptApp(name, directory, { runScriptName: "storybook:aspire" })
			.withYarn({ install: false })
			.withHttpEndpoint({ env: "STORYBOOK_PORT", name: "http" })
			.withHttpProbe(ProbeType.Readiness, {
				endpointName: "http",
				path: "/index.json",
				periodSeconds: 2,
				timeoutSeconds: 5,
				failureThreshold: 3,
				successThreshold: 1,
			})
			.excludeFromManifest();
		const endpoint = await resource.getEndpoint("http");
		await resource
			.withEnvironment("STORYBOOK_URL", endpoint)
			.withUrl(refExpr`${endpoint}/mcp`, { displayText: "MCP" })
			.withUrl(refExpr`${endpoint}/?path=/review/`, { displayText: "Review" });
		return resource;
	}

	const text = await add("storybook-text", "../apps/rezics-text");
	const about = await add("storybook-about", "../apps/about");
	const web = await add("storybook-web", "../apps/web");
	await web
		.withEnvironment("STORYBOOK_TEXT_URL", await text.getEndpoint("http"))
		.withEnvironment("STORYBOOK_ABOUT_URL", await about.getEndpoint("http"))
		.waitFor(text)
		.waitFor(about);
	return { web, text, about };
}
