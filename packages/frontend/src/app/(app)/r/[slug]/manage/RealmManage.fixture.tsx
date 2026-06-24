import type { ReactNode } from "react";
import ManageRealmDockPage from "./dock/page";
import ManageRealmMembersPage from "./members/page";
import ManageRealmModerationPage from "./moderation/page";
import ManageRealmProfilePage from "./profile/page";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">{children}</div>;
}

function NarrowFrame({ children }: { readonly children: ReactNode }) {
  return <div className="max-w-80 p-3">{children}</div>;
}

export default {
  ProfileFormEmpty: (
    <Frame>
      <ManageRealmProfilePage />
    </Frame>
  ),
  MembersEmptyTable: (
    <Frame>
      <ManageRealmMembersPage />
    </Frame>
  ),
  ModerationEmptyTable: (
    <Frame>
      <ManageRealmModerationPage />
    </Frame>
  ),
  DockAllEnabled: (
    <Frame>
      <ManageRealmDockPage />
    </Frame>
  ),
  NarrowProfileForm: (
    <NarrowFrame>
      <ManageRealmProfilePage />
    </NarrowFrame>
  ),
  NarrowMembersTable: (
    <NarrowFrame>
      <ManageRealmMembersPage />
    </NarrowFrame>
  ),
};
