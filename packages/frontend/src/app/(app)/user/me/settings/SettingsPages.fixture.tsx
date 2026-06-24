"use client";

import type { ReactNode } from "react";
import { SettingsAccountContent } from "./account/page";
import { type Provider, SettingsConnectionsContent } from "./connections/page";
import SettingsLayout from "./layout";
import { SettingsLibraryContent } from "./library/page";
import { SettingsNotificationsContent } from "./notifications/page";
import { SettingsPreferencesContent } from "./preferences/page";
import { SettingsSecurityContent } from "./security/page";
import { SettingsTokensContent, type Token } from "./tokens/page";

const longName =
  "一个显示名非常非常非常长的跨语言作品目录协作者用于测试账户设置输入框";
const longUsername = "user-with-a-very-long-settings-handle";
const longEmail = "very.long.settings.identity@example.rezics.local";

const providers: Provider[] = [
  { id: "github", name: "GitHub", connected: true },
  {
    id: "google",
    name: "Google Workspace with a very long organization label",
    connected: false,
  },
  { id: "discord", name: "Discord", connected: true },
];

const tokens: Token[] = [
  {
    id: "token-1",
    name: "CI release automation token with a very very long descriptive name",
    createdAt: "2025-06-18T00:00:00.000Z",
    lastUsed: "2025-06-20",
  },
  {
    id: "token-2",
    name: "Personal import script",
    createdAt: "2025-06-10T00:00:00.000Z",
    lastUsed: null,
  },
];

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

function MobileFrame({ children }: { readonly children: ReactNode }) {
  return <div className="w-80 p-3">{children}</div>;
}

function WithLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Frame>
      <SettingsLayout>{children}</SettingsLayout>
    </Frame>
  );
}

export default {
  AccountEmpty: (
    <WithLayout>
      <SettingsAccountContent />
    </WithLayout>
  ),
  AccountPrefilledLongText: (
    <WithLayout>
      <SettingsAccountContent
        initialDisplayName={longName}
        initialEmail={longEmail}
        initialUsername={longUsername}
      />
    </WithLayout>
  ),
  SecurityTwoFactorEnabled: (
    <WithLayout>
      <SettingsSecurityContent initialTwoFactorEnabled />
    </WithLayout>
  ),
  PreferencesZhDarkMature: (
    <WithLayout>
      <SettingsPreferencesContent
        initialContentRating="mature"
        initialLanguage="zh-hans"
        initialTheme="dark"
      />
    </WithLayout>
  ),
  NotificationsMixed: (
    <WithLayout>
      <SettingsNotificationsContent
        initialEmailNotifs={false}
        initialMentions
        initialPostReplies={false}
        initialPushNotifs
        initialRealmUpdates
      />
    </WithLayout>
  ),
  ConnectionsMixed: (
    <WithLayout>
      <SettingsConnectionsContent initialProviders={providers} />
    </WithLayout>
  ),
  LibraryListNoProgress: (
    <WithLayout>
      <SettingsLibraryContent
        initialDefaultView="list"
        initialShowProgress={false}
        initialShowRatings
        initialSortBy="title"
      />
    </WithLayout>
  ),
  TokensEmpty: (
    <WithLayout>
      <SettingsTokensContent />
    </WithLayout>
  ),
  TokensWithLongNames: (
    <WithLayout>
      <SettingsTokensContent initialTokens={tokens} />
    </WithLayout>
  ),
  MobileAccountPressure: (
    <MobileFrame>
      <SettingsAccountContent
        initialDisplayName={longName}
        initialEmail={longEmail}
        initialUsername={longUsername}
      />
    </MobileFrame>
  ),
  MobileTokensPressure: (
    <MobileFrame>
      <SettingsTokensContent initialTokens={tokens} />
    </MobileFrame>
  ),
};
