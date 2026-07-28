import { proxyBackendRequest } from "@/lib/backend-proxy.server";

type RouteContext = {
	readonly params: Promise<{ readonly path: readonly string[] }>;
};

async function handle(request: Request, { params }: RouteContext): Promise<Response> {
	const { path } = await params;
	return proxyBackendRequest(request, { prefix: "api", path });
}

export {
	handle as DELETE,
	handle as GET,
	handle as HEAD,
	handle as OPTIONS,
	handle as PATCH,
	handle as POST,
	handle as PUT,
};
