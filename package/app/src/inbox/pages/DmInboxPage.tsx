import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import { ConversationListSection } from "../sections/ConversationListSection";
import { InboxTabBar } from "../components/InboxTabBar";

export const DmInboxPage: React.FC = () => {
  return (
    <div className="mx-auto mt-16 w-11/12 max-w-3xl">
      <div className="mb-6">
        <AccentBarWithText text="Direct Messages" />
      </div>
      <InboxTabBar active="dm" />
      <div className="mt-4">
        <ConversationListSection />
      </div>
    </div>
  );
};
