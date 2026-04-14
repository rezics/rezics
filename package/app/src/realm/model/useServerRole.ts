import { getRezicsSessionClaims } from '@rezics/api/react-query/jwt';
import { useMemo } from 'react';
import { useAuthSessionStore } from '@/user/state/authSessionStore';

export function useServerRole(): string | null {
  const capabilityLevel = useAuthSessionStore((s) => s.capabilityLevel);
  return useMemo(() => {
    if (capabilityLevel !== 'member') return null;
    return getRezicsSessionClaims()?.role ?? null;
  }, [capabilityLevel]);
}
