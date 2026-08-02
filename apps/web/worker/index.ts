import vinextHandler from "vinext/server/fetch-handler";

const deploymentProbeRequestHeader = "x-rezics-deployment-probe";
const deploymentProbeResponseHeader = "x-rezics-worker-version";

const worker = {
	async fetch(request, environment, context) {
		const response = await vinextHandler.fetch(request, environment, context);

		if (request.headers.get(deploymentProbeRequestHeader) !== "1") return response;

		const headers = new Headers(response.headers);
		headers.set("cache-control", "no-store");
		headers.set(deploymentProbeResponseHeader, environment.WORKER_VERSION.id);

		return new Response(response.body, {
			headers,
			status: response.status,
			statusText: response.statusText,
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;

export default worker;
