import {userService} from './user.service';
import type {JWTPayload, RefreshTokenPayload} from './types';
import {sessionService} from './user.session.service';

import {v7 as uuidv7} from 'uuid';

import {verifyAuth} from './utils';

import {t} from 'elysia';
import {coreInstance} from '../core';
import {setCookie} from '../utils/cookie';

import {allowEmailDomains} from './allowEmailDomains';
import {verifyTurnstileToken} from '../utils/turnstileUtils';

export const verifyRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
      /**
       * Refresh token
       * POST /users/refresh-token
       */
      .post(
        '/refresh-token',
        async ({
          headers,
          jwt,
          refreshToken,
          set,
          cookie: {refresh_token},
        }): Promise<{token: string}> => {
          const refreshTokenCookieValue = refresh_token?.value as string;
          const payload = await verifyAuth<RefreshTokenPayload>(
            refreshTokenCookieValue,
            refreshToken,
            set,
          );

          console.log('generate new token', payload);

          // 基于数据库会话进行二次校验（哈希比对 / 过期 / 撤销等）
          const validation = await sessionService.validateAndMarkUsed({
            sessionId: payload.sessionId,
            refreshToken: headers.refreshToken ?? '',
          });

          if (!validation.valid) {
            set.status = 401;
            throw new Error(
              `Unauthorized: Refresh session invalid (${validation.reason})`,
            );
          }

          // 优先使用会话中的 userId，确保与数据库一致
          const userId = validation.session.userId ?? payload.unitId;
          const user = await userService.getByUnitId(userId);
          const token = await jwt.sign({
            unitId: user.unitId,
            email: user.email,
            slug: user.slug,
            permission: user.permission,
          } as JWTPayload);

          const newSessionId = uuidv7();
          const newRefreshTokenSign = await refreshToken.sign({
            sessionId: newSessionId,
            unitId: user.unitId,
            type: 'refreshToken',
          } as RefreshTokenPayload);
          await sessionService.createSession({
            sessionId: newSessionId,
            userId: user.unitId,
            refreshToken: newRefreshTokenSign,
          });

          setCookie(refresh_token!, {
            value: newRefreshTokenSign,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/users/refresh-token',
            maxAge: 60 * 60 * 24 * 30,
          });

          return {
            token: token,
          };
        },
        {
          detail: {
            summary: 'Refresh token',
            description: 'Refresh JWT token',
            tags: ['Users'],
          },
        },
      )
      /**
       * Send verification code
       * POST /users/send-verification-code
       */
      .post(
        '/send-verification-code',
        async ({body, set}) => {
          const email = body.email;
          const turnstileToken = body.turnstileToken;
          if (turnstileToken) {
            const result = await verifyTurnstileToken(turnstileToken);
            if (!result.success) {
              set.status = 400;
              throw new Error('Bot detected');
            }
          }

          if (
            !allowEmailDomains.includes(
              email.split('@')[1] ?? 'invalid-email-domain',
            )
          ) {
            set.status = 400;
            throw new Error('Invalid email domain');
          }
          const result = await userService.sendVerificationCode(email);
          if (result.status === 'error') {
            set.status = 400;
            throw new Error(result.data);
          }
          return {data: {status: 'success', info: result.data}};
        },
        {
          body: t.Object({
            email: t.String(),
            turnstileToken: t.Optional(t.String()),
          }),
          detail: {
            summary: 'Send verification code',
            description: 'Send verification code to user',
            tags: ['Users', 'Verification Code'],
          },
        },
      )

      /**
       * Verify verification code
       * POST /users/verify-verification-code
       */
      .post(
        '/verify-verification-code',
        async ({headers, jwt, body, set}) => {
          const payload = await verifyAuth<JWTPayload>(
            headers.authorization,
            jwt,
            set,
          );
          const email = payload.email;
          await userService.verifyVerificationCode(email, body.code);
        },
        {
          body: t.Object({
            code: t.String(),
          }),
          detail: {
            summary: 'Verify verification code',
            description: 'Verify verification code',
            tags: ['Users', 'Verification Code'],
          },
        },
      )
  );
};
