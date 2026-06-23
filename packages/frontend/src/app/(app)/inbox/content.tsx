"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";
import { BellIcon, MessageSquareIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const TABS = ["notifications", "messages"] as const;
type TabKind = (typeof TABS)[number];

export function InboxContent() {
  const [t] = useT();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("notifications"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{t.nav.inbox}</h1>

      <Tabs
        onValueChange={(details) => setTab(details.value as TabKind)}
        value={tab}
      >
        <TabsList>
          <TabsTrigger value="notifications">
            <BellIcon className="mr-1.5 size-4" />
            {t.nav.notifications}
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquareIcon className="mr-1.5 size-4" />
            {t.nav.messages}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="py-4" value="notifications">
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t.inbox.noNotifications}
          </div>
        </TabsContent>

        <TabsContent className="py-4" value="messages">
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t.inbox.noMessages}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
