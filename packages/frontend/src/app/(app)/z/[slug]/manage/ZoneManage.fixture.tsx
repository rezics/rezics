import type { ReactNode } from "react";
import ManageZoneMenusPage from "./menus/page";
import ManageZonePagesPage from "./pages/page";
import ManageZoneProfilePage from "./profile/page";
import ManageZoneThemePage from "./theme/page";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">{children}</div>;
}

function NarrowFrame({ children }: { readonly children: ReactNode }) {
  return <div className="max-w-80 p-3">{children}</div>;
}

export default {
  ProfileFormEmpty: (
    <Frame>
      <ManageZoneProfilePage />
    </Frame>
  ),
  ThemeDefaults: (
    <Frame>
      <ManageZoneThemePage />
    </Frame>
  ),
  PagesEmpty: (
    <Frame>
      <ManageZonePagesPage />
    </Frame>
  ),
  MenusEmpty: (
    <Frame>
      <ManageZoneMenusPage />
    </Frame>
  ),
  NarrowProfileForm: (
    <NarrowFrame>
      <ManageZoneProfilePage />
    </NarrowFrame>
  ),
  NarrowMenusHeader: (
    <NarrowFrame>
      <ManageZoneMenusPage />
    </NarrowFrame>
  ),
};
