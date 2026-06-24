"use client";

import { mockRealm, mockRealms } from "@/__cosmos__/mock-data";
import type { ReactNode } from "react";
import { JoinButton } from "./JoinButton";

function Canvas({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-start gap-4 p-4">
      {children}
    </div>
  );
}

export default {
  DefaultAnonymousOrLoading: (
    <Canvas>
      <JoinButton realmId={mockRealm().id} />
    </Canvas>
  ),

  MobileDense: (
    <div className="mx-auto flex w-full max-w-[320px] flex-wrap items-center gap-2 p-2">
      {mockRealms().slice(0, 4).map((realm) => (
        <JoinButton key={realm.id} realmId={realm.id} />
      ))}
    </div>
  ),

  LongRealmId: (
    <Canvas>
      <JoinButton realmId="realm-with-a-very-very-long-identifier-for-query-key-pressure" />
    </Canvas>
  ),
};
