import {Elysia} from 'elysia';
import {getMainSessionPublicJwks} from '../session/jwt/jwt.service';
import {serverCorsPolicy} from '@/middleware';

export const wellKnownApi = new Elysia({prefix: '/.well-known'})
  .use(serverCorsPolicy('public'))
  .get('/jwks.json', () => getMainSessionPublicJwks(), {
    detail: {
      summary: 'JWKS endpoint',
      description:
        'Canonical RFC 7517 JWKS endpoint. Returns the public signing keys used by this resource server for session tokens. This is the primary JWKS discovery URL used for token verification.',
      tags: ['Well-Known'],
    },
  });
