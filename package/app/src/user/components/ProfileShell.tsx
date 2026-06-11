import { Outlet } from "@tanstack/react-router";
import type { FC } from "react";
import { ProfileTabBar } from "./ProfileTabBar";

interface ProfileShellProps {
  isCurrentUser?: boolean;
  profileBasePath: string;
}

export const ProfileShell: FC<ProfileShellProps> = ({
  isCurrentUser = false,
  profileBasePath,
}) => (
  <div className="min-w-0 flex-1">
    <ProfileTabBar
      isCurrentUser={isCurrentUser}
      profileBasePath={profileBasePath}
    />
    <div className="pt-4">
      <Outlet />
    </div>
  </div>
);
