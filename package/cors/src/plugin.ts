import {Elysia} from 'elysia';
import {applyHeaders, preflightResponse} from './headers';
import type {CorsPolicyConfig, CorsPolicyName} from './types';

export function corsPolicy(
  defaultPolicy: CorsPolicyName,
  configs: Record<CorsPolicyName, CorsPolicyConfig>,
) {
  return new Elysia({name: '@package/cors'})
    .resolve({as: 'scoped'}, () => ({
      __corsPolicy: defaultPolicy as CorsPolicyName,
    }))
    .macro({
      corsPolicy: (policyName: CorsPolicyName) => ({
        resolve: () => ({__corsPolicy: policyName}),
      }),
    })
    .onRequest(({request}) => {
      if (request.method === 'OPTIONS') {
        return preflightResponse(request, configs[defaultPolicy]);
      }
    })
    .onAfterHandle({as: 'scoped'}, ({request, response, __corsPolicy}) => {
      const config = configs[__corsPolicy];
      if (response instanceof Response) {
        applyHeaders(request, response.headers, config);
        return response;
      }
      const res = Response.json(response ?? null);
      applyHeaders(request, res.headers, config);
      return res;
    })
    .onError({as: 'scoped'}, ({request, set}) => {
      const config = configs[defaultPolicy];
      const origin = request.headers.get('origin');
      if (origin && config.origin.includes(origin)) {
        set.headers['access-control-allow-origin'] = origin;
        set.headers['vary'] = 'Origin';
      }
      set.headers['access-control-allow-methods'] = config.methods.join(', ');
      set.headers['access-control-allow-headers'] =
        config.allowedHeaders.join(', ');
      if (config.exposeHeaders.length > 0) {
        set.headers['access-control-expose-headers'] =
          config.exposeHeaders.join(', ');
      }
      if (config.credentials) {
        set.headers['access-control-allow-credentials'] = 'true';
      }
    });
}
