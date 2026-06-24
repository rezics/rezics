"use client";

import { mockSession } from "@/__cosmos__/mock-data";
import { authClient } from "@/lib/auth-client";
import { useEffect, useRef, type ReactNode } from "react";
import { Header } from "./Header";

type Session = ReturnType<typeof mockSession>;
type AuthClientPatch = {
  signOut: () => Promise<void>;
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
  const originalSignOut = useRef<AuthClientPatch["signOut"] | null>(null);
  const client = authClient as unknown as AuthClientPatch;

  if (originalUseSession.current === null) {
    originalUseSession.current = client.useSession;
    originalSignOut.current = client.signOut;
    client.useSession = () => ({ data: session });
    client.signOut = () => Promise.resolve();
  }

  useEffect(() => {
    return () => {
      if (originalUseSession.current && originalSignOut.current) {
        client.useSession = originalUseSession.current;
        client.signOut = originalSignOut.current;
      }
    };
  }, [client]);

  return children;
}

/**
 * Header fixture — authClient is patched locally so both anonymous and logged-in
 * navigation states can render without a backend session.
 */
export default {
  Anonymous: (
    <AuthScenario session={null}>
      <Header />
    </AuthScenario>
  ),

  LoggedIn: (
    <AuthScenario session={mockSession()}>
      <Header />
    </AuthScenario>
  ),

  LoggedInLongName: (
    <AuthScenario
      session={mockSession({
        user: {
          email: "averylongname@example.com",
          id: "user-averylongname",
          image: null,
          name: "Very Long User Display Name",
        },
      })}
    >
      <Header />
    </AuthScenario>
  ),
};
