import { Outlet } from "@tanstack/react-router";
import type { FC } from "react";
import { ProfileTabBar } from "./ProfileTabBar";

interface ProfileShellProps {
  unitId: string;
}

export const ProfileShell: FC<ProfileShellProps> = ({ unitId }) => (
  <div className="min-w-0 flex-1">
    <ProfileTabBar unitId={unitId} />
    <div className="pt-4">
      <Outlet />
    </div>
  </div>
);
