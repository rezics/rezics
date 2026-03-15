// Local barrel — re-exports everything for auth-service internal use.

export {
  verifyToken,
  verifyBearerToken,
  verifySessionToken,
} from './verify';
export type {VerifiedToken, VerifyOptions} from './verify';

export {
  getAuthIdentityVerifyOptions,
  getAuthContextVerifyOptions,
  verifyAuthIdentityToken,
  verifyAuthContextToken,
  verifyAuth,
} from './auth-local';
