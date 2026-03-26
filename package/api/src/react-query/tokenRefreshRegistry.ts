import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {userApi} from '../user/user.api';
import {useAuthSessionStore} from '@package/app-shell/state/authSessionStore';

export type TokenRefreshFn = () => Promise<{token: string}>;

export type TokenRefreshRegistry = Partial<
  Record<NormalizedTokenNameType, TokenRefreshFn>
>;

const defaultEntries: TokenRefreshRegistry = {
  [NormalizedTokenName.REZICS_SESSION]: async () => {
    const response = await userApi.issueSessionToken();
    useAuthSessionStore.getState().syncBusinessToken(response.token);
    return {token: response.token};
  },
};

export function createTokenRefreshRegistry(
  overrides?: TokenRefreshRegistry,
): TokenRefreshRegistry {
  if (!overrides) return {...defaultEntries};
  return {...defaultEntries, ...overrides};
}
