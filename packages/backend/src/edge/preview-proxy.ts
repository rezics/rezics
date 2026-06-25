export interface PreviewProxyEnv {
  PREVIEW_BASE_URL: string;
  PREVIEW_INTERNAL_SECRET?: string;
}

export interface PreviewProxyOptions {
  fetchImpl?: typeof fetch;
}

function previewUrl(baseUrl: string, requestUrl: string): string {
  const source = new URL(requestUrl);
  const target = new URL(baseUrl);
  const basePath = target.pathname.replace(/\/+$/, "");
  target.pathname = `${basePath}${source.pathname}`;
  target.search = source.search;
  return target.toString();
}

function previewHeaders(request: Request, secret?: string): Headers {
  const headers = new Headers(request.headers);
  headers.delete("host");
  if (secret) headers.set("x-internal-secret", secret);
  return headers;
}

export async function proxyPreviewRequest(
  request: Request,
  env: PreviewProxyEnv,
  options: PreviewProxyOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!env.PREVIEW_BASE_URL) {
    return new Response("Preview service is not configured.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const response = await fetchImpl(
      previewUrl(env.PREVIEW_BASE_URL, request.url),
      {
        method: request.method,
        headers: previewHeaders(request, env.PREVIEW_INTERNAL_SECRET),
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        redirect: "manual",
      },
    );
    const nextHeaders = new Headers(response.headers);
    if (!nextHeaders.has("cache-control")) {
      nextHeaders.set(
        "cache-control",
        "public, max-age=60, stale-while-revalidate=300",
      );
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    });
  } catch {
    return new Response("Preview service is temporarily unavailable.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}
