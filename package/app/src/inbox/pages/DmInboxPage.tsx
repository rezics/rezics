import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import { InboxTabBar } from "../components/InboxTabBar";
import { ConversationListSection } from "../sections/ConversationListSection";

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
