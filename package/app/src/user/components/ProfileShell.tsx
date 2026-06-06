import { Outlet } from "@tanstack/react-router";
import type { FC } from "react";
import { ProfileTabBar } from "./ProfileTabBar";

interface ProfileShellProps {
  userId: string;
  userSlug?: string;
}

export const ProfileShell: FC<ProfileShellProps> = ({ userId, userSlug }) => (
  <div className="min-w-0 flex-1">
    <ProfileTabBar userId={userId} userSlug={userSlug} />
    <div className="pt-4">
      <Outlet />
    </div>
  </div>
);
