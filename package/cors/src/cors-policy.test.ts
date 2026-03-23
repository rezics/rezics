import {describe, expect, test} from 'bun:test';
import {Elysia} from 'elysia';
import {corsPolicy} from './plugin';
import type {CorsPolicyConfig, CorsPolicyName} from './types';

const allowedOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const configs: Record<CorsPolicyName, CorsPolicyConfig> = {
  credentialed: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
    exposeHeaders: ['Content-Type', 'x-session-token'],
  },
  public: {
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: [],
  },
  internal: {
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
    exposeHeaders: [],
  },
};

function makeRequest(path: string, method = 'GET', origin = 'https://book.rezics.com') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {Origin: origin},
  });
}

describe('corsPolicy plugin', () => {
  describe('default policy inheritance', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/test', () => 'ok');

    test('routes inherit the default policy headers', async () => {
      const res = await app.handle(makeRequest('/test'));
      expect(res.headers.get('access-control-allow-origin')).toBe('https://book.rezics.com');
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
      expect(res.headers.get('access-control-expose-headers')).toContain('x-session-token');
    });
  });

  describe('route-level policy override via macro', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/default', () => 'default')
      .get('/public', () => 'public', {corsPolicy: 'public'});

    test('route without override gets credentialed headers', async () => {
      const res = await app.handle(makeRequest('/default'));
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      expect(res.headers.get('access-control-allow-methods')).toContain('DELETE');
    });

    test('route with public override gets public headers', async () => {
      const res = await app.handle(makeRequest('/public'));
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
      expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
      expect(res.headers.get('access-control-expose-headers')).toBeNull();
    });

    test('override does not affect other routes', async () => {
      const defaultRes = await app.handle(makeRequest('/default'));
      const publicRes = await app.handle(makeRequest('/public'));
      expect(defaultRes.headers.get('access-control-allow-credentials')).toBe('true');
      expect(publicRes.headers.get('access-control-allow-credentials')).toBeNull();
    });
  });

  describe('origin validation', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/test', () => 'ok');

    test('allowed origin receives CORS headers', async () => {
      const res = await app.handle(makeRequest('/test', 'GET', 'https://rezics.com'));
      expect(res.headers.get('access-control-allow-origin')).toBe('https://rezics.com');
      expect(res.headers.get('vary')).toBe('Origin');
    });

    test('disallowed origin receives no allow-origin header', async () => {
      const res = await app.handle(makeRequest('/test', 'GET', 'https://evil.com'));
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    test('request without origin receives no allow-origin header', async () => {
      const res = await app.handle(new Request('http://localhost/test'));
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('credentials header', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/cred', () => 'ok')
      .get('/pub', () => 'ok', {corsPolicy: 'public'});

    test('credentialed policy includes credentials header', async () => {
      const res = await app.handle(makeRequest('/cred'));
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });

    test('public policy excludes credentials header', async () => {
      const res = await app.handle(makeRequest('/pub'));
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    });
  });

  describe('preflight interception', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/test', () => 'ok');

    test('OPTIONS request returns 204 with CORS headers', async () => {
      const res = await app.handle(makeRequest('/test', 'OPTIONS'));
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://book.rezics.com');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
      expect(res.headers.get('access-control-max-age')).toBe('600');
    });

    test('GET request is not intercepted', async () => {
      const res = await app.handle(makeRequest('/test'));
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('ok');
    });
  });

  describe('error response headers', () => {
    const app = new Elysia()
      .use(corsPolicy('credentialed', configs))
      .get('/error', () => {
        throw new Error('test error');
      });

    test('error responses carry CORS headers', async () => {
      const res = await app.handle(makeRequest('/error'));
      expect(res.headers.get('access-control-allow-origin')).toBe('https://book.rezics.com');
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });
  });

  describe('scope isolation', () => {
    const routerA = new Elysia({prefix: '/a'})
      .use(corsPolicy('credentialed', configs))
      .get('/test', () => 'a');

    const routerB = new Elysia({prefix: '/b'}).get('/test', () => 'b');

    const app = new Elysia().use(routerA).use(routerB);

    test('router with plugin gets CORS headers', async () => {
      const res = await app.handle(makeRequest('/a/test'));
      expect(res.headers.get('access-control-allow-origin')).toBe('https://book.rezics.com');
    });

    test('router without plugin does NOT get CORS headers', async () => {
      const res = await app.handle(makeRequest('/b/test'));
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
