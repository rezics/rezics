"use client";

import { mockSession } from "@/__cosmos__/mock-data";
import { authClient } from "@/lib/auth-client";
import { useEffect, useRef, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";

type Session = ReturnType<typeof mockSession>;
type AuthClientPatch = {
  useSession: () => { readonly data: Session | null };
};

function AuthScenario({
  session,
  children,
}: {
  readonly session: Session | null;
  readonly children: ReactNode;
}) {
  const originalUseSession = useRef<AuthClientPatch["useSession"] | null>(null);
  const client = authClient as unknown as AuthClientPatch;

  if (originalUseSession.current === null) {
    originalUseSession.current = client.useSession;
    client.useSession = () => ({ data: session });
  }

  useEffect(() => {
    return () => {
      if (originalUseSession.current) {
        client.useSession = originalUseSession.current;
      }
    };
  }, [client]);

  return children;
}

/**
 * BottomNav fixture — authClient is patched locally so anonymous and logged-in
 * navigation states render without a backend session.
 */
export default {
  Anonymous: (
    <AuthScenario session={null}>
      <BottomNav />
    </AuthScenario>
  ),

  LoggedIn: (
    <AuthScenario session={mockSession()}>
      <BottomNav />
    </AuthScenario>
  ),

  MobileDense: (
    <AuthScenario session={mockSession()}>
      <div className="mx-auto w-full max-w-[320px]">
        <BottomNav />
      </div>
    </AuthScenario>
  ),
};
