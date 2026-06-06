import { isVerifiedBotRequest } from "./bot";
import { proxyPreviewRequest, type PreviewProxyEnv } from "./preview-proxy";
import { isPreviewEligiblePath } from "./routes";

export interface EdgeEnv extends PreviewProxyEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export async function handleRequest(
  request: Request,
  env: EdgeEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (isPreviewEligiblePath(url.pathname) && isVerifiedBotRequest(request)) {
    return proxyPreviewRequest(request, env);
  }
  return env.ASSETS.fetch(request);
}

export default {
  fetch(request: Request, env: EdgeEnv) {
    return handleRequest(request, env);
  },
};
