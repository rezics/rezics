import { Outlet } from "@tanstack/react-router";
import type { FC } from "react";
import { ProfileTabBar } from "./ProfileTabBar";

interface ProfileShellProps {
  unitId: string;
  userSlug?: string;
}

export const ProfileShell: FC<ProfileShellProps> = ({ unitId, userSlug }) => (
  <div className="min-w-0 flex-1">
    <ProfileTabBar unitId={unitId} userSlug={userSlug} />
    <div className="pt-4">
      <Outlet />
    </div>
  </div>
);
