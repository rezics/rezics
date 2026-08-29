import vinextHandler from "vinext/server/fetch-handler";

import {
	contentSecurityPolicy,
	handlePresentationPolicyProbeRequest,
	isDocumentRequest,
	isPresentationPolicyProbeRequest,
	NonceRequestHeader,
	PresentationRevisionRequestHeader,
	resolvePresentationPolicyForRequest,
} from "./presentation-policy";
import {
	handleSecurityReportRequest,
	isSecurityReportRequest,
	SecurityReportPath,
} from "./security-report";
import {
	handlePresentationRuntimeReportRequest,
	isPresentationRuntimeReportRequest,
} from "./presentation-runtime-report";
import {
	handleCustomThemeReferenceRenderRequest,
	isCustomThemeReferenceRenderRequest,
} from "./custom-theme-reference-render";

const deploymentProbeRequestHeader = "x-rezics-deployment-probe";
const deploymentProbeResponseHeader = "x-rezics-worker-version";

const worker = {
	async fetch(request, environment, context) {
		if (isCustomThemeReferenceRenderRequest(request))
			return handleCustomThemeReferenceRenderRequest(request, environment);
		if (isPresentationPolicyProbeRequest(request))
			return handlePresentationPolicyProbeRequest(request, environment);
		if (isPresentationRuntimeReportRequest(request))
			return handlePresentationRuntimeReportRequest(request);
		if (isSecurityReportRequest(request)) return handleSecurityReportRequest(request);
		let renderRequest = request;
		let documentPolicy: { readonly csp: string; readonly revisionId: string | null } | undefined;
		if (isDocumentRequest(request)) {
			const nonce = crypto.randomUUID();
			let policy;
			try {
				policy = await resolvePresentationPolicyForRequest(request, environment);
			} catch (error) {
				policy = {
					revisionId: null,
					scriptOrigins: [],
					styleOrigins: [],
					connectOrigins: [],
					imageOrigins: [],
					fontOrigins: [],
					frameOrigins: [],
					mediaOrigins: [],
				};
				console.error(
					JSON.stringify({
						event: "presentation_policy_resolution_failed",
						message: error instanceof Error ? error.message : "unknown error",
						pathname: new URL(request.url).pathname,
					}),
				);
			}
			const frontendUrl = new URL(environment.FRONTEND_URL);
			const csp = contentSecurityPolicy({
				development: ["localhost", "127.0.0.1"].includes(frontendUrl.hostname),
				fontAwesomeCssUrl: environment.FONT_AWESOME_KIT_CSS_URL,
				nonce,
				policy,
				secureRequest: new URL(request.url).protocol === "https:",
			});
			const headers = new Headers(request.headers);
			headers.set(NonceRequestHeader, nonce);
			headers.set("content-security-policy", csp);
			headers.set(PresentationRevisionRequestHeader, policy.revisionId ?? "");
			renderRequest = new Request(request, { headers });
			documentPolicy = { csp, revisionId: policy.revisionId };
		}

		const response = await vinextHandler.fetch(renderRequest, environment, context);
		const responseHeaders = new Headers(response.headers);
		if (documentPolicy) {
			const reportEndpoint = new URL(SecurityReportPath, request.url).href;
			responseHeaders.set("cache-control", "private, no-store");
			responseHeaders.set("content-security-policy", documentPolicy.csp);
			responseHeaders.set(
				"reporting-endpoints",
				`rezics-csp="${reportEndpoint}", rezics-integrity="${reportEndpoint}"`,
			);
			responseHeaders.set(
				"integrity-policy-report-only",
				"blocked-destinations=(script style), endpoints=(rezics-integrity)",
			);
			responseHeaders.set(PresentationRevisionRequestHeader, documentPolicy.revisionId ?? "");
			responseHeaders.set("referrer-policy", "strict-origin-when-cross-origin");
			responseHeaders.set("x-content-type-options", "nosniff");
		}

		if (request.headers.get(deploymentProbeRequestHeader) !== "1" && !documentPolicy)
			return response;

		if (request.headers.get(deploymentProbeRequestHeader) === "1") {
			responseHeaders.set("cache-control", "no-store");
			responseHeaders.set(deploymentProbeResponseHeader, environment.WORKER_VERSION.id);
		}

		return new Response(response.body, {
			headers: responseHeaders,
			status: response.status,
			statusText: response.statusText,
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;

export default worker;
