import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { getRouteApi } from "@tanstack/react-router";
import type React from "react";
import { InboxTabBar } from "../components/InboxTabBar";
import { ConversationListSection } from "../sections/ConversationListSection";

const routeApi = getRouteApi("/_mainLayout/inbox/dm/");

export const DmInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { peerId } = routeApi.useSearch();
  return (
    <div className="mx-auto mt-16 w-11/12 max-w-3xl">
      <div className="mb-6">
        <AccentBarWithText text={t("community:dm_inbox_title")} />
      </div>
      <InboxTabBar active="dm" />
      <div className="mt-4">
        <ConversationListSection openPeerId={peerId} />
      </div>
    </div>
  );
};
