import {describe, expect, test} from 'bun:test';
import {Elysia} from 'elysia';

/**
 * Spike test: verify that a macro's resolve runs AFTER a scoped resolve,
 * so macro can overwrite a default value set by the plugin.
 *
 * This is the load-bearing assumption for the corsPolicy plugin design:
 *   - scoped resolve sets __corsPolicy = defaultPolicy
 *   - macro resolve (route-local) overwrites __corsPolicy = routePolicy
 *   - a single afterHandle reads the winning value
 */
describe('macro resolve ordering', () => {
  const app = new Elysia()
    .resolve(() => ({policy: 'default'}))
    .macro({
      overridePolicy: (value: string) => ({
        resolve: () => ({policy: value}),
      }),
    })
    .get('/no-override', ({policy}) => policy)
    .get('/with-override', ({policy}) => policy, {
      overridePolicy: 'custom',
    });

  test('route without macro gets the scoped default', async () => {
    const res = await app.handle(new Request('http://localhost/no-override'));
    expect(await res.text()).toBe('default');
  });

  test('route with macro override gets the macro value', async () => {
    const res = await app.handle(
      new Request('http://localhost/with-override'),
    );
    expect(await res.text()).toBe('custom');
  });
});

describe('preflight via onRequest intercept', () => {
  /**
   * OPTIONS doesn't route to .get() handlers, so beforeHandle never fires.
   * Test whether onRequest can intercept OPTIONS early and return a response.
   */
  const app = new Elysia()
    .onRequest(({request, set}) => {
      if (request.method === 'OPTIONS') {
        set.status = 204;
        set.headers['x-preflight'] = 'intercepted';
        return new Response(null, {
          status: 204,
          headers: {'x-preflight': 'intercepted'},
        });
      }
    })
    .get('/foo', () => 'ok');

  test('onRequest intercepts OPTIONS before routing', async () => {
    const res = await app.handle(
      new Request('http://localhost/foo', {method: 'OPTIONS'}),
    );
    expect(res.status).toBe(204);
  });
});

describe('preflight via catch-all .options() with resolve', () => {
  /**
   * Alternative: register .options('/*') that reads the resolved policy.
   * The macro resolve should still run before the options handler.
   */
  const app = new Elysia()
    .resolve(() => ({policy: 'default'}))
    .macro({
      overridePolicy: (value: string) => ({
        resolve: () => ({policy: value}),
      }),
    })
    .options('/*', ({policy}) => new Response(policy, {status: 204}))
    .get('/foo', ({policy}) => policy)
    .get('/bar', ({policy}) => policy, {overridePolicy: 'custom'});

  test('OPTIONS /foo gets default policy', async () => {
    const res = await app.handle(
      new Request('http://localhost/foo', {method: 'OPTIONS'}),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('default');
  });

  test('OPTIONS /bar — does catch-all see macro override?', async () => {
    /**
     * This tests whether the macro on GET /bar also affects OPTIONS /bar.
     * Expected: NO — the macro is on the GET route, not the OPTIONS catch-all.
     * The catch-all .options('/*') is its own route without the macro.
     */
    const res = await app.handle(
      new Request('http://localhost/bar', {method: 'OPTIONS'}),
    );
    expect(res.status).toBe(204);
    const text = await res.text();
    // Document actual behavior — we expect 'default' since macro is on GET /bar
    console.log(`OPTIONS /bar resolved policy: "${text}"`);
    expect(text).toBe('default');
  });
});
