import type {GetSessionStateResponse} from '@rezics/contract';
import {env} from '../env';

export async function getAuthSessionState(
  authorization: string,
  cookie?: string,
): Promise<GetSessionStateResponse> {
  const headers: Record<string, string> = {
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const response = await fetch(`${env.AUTH_BASE_URL}/api/auth/get-session-state`, {
    method: 'GET',
    headers,
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
