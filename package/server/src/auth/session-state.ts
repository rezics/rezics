import type {GetSessionStateResponse} from '@package/contract';
import {env} from '../env';

function getAuthApiBaseUrl(): string {
  return env.AUTH_API_URL ?? env.AUTH_JWT_ISSUER ?? 'http://localhost:35003';
}

export async function getAuthSessionState(
  authorization: string,
): Promise<GetSessionStateResponse> {
  const response = await fetch(`${getAuthApiBaseUrl()}/api/auth/get-session-state`, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.message ?? 'Failed to read auth session state from auth service',
    );
  }

  return json as GetSessionStateResponse;
}

export function assertMainServerEligibility(
  sessionState: GetSessionStateResponse,
): void {
  if (!sessionState.session?.id || !sessionState.user?.id) {
    throw new Error('Unauthorized: Missing auth session state');
  }

  if (!sessionState.authSession?.canAcquireMemberToken) {
    throw new Error('Forbidden: Auth session is not ready for main-server access');
  }
}
