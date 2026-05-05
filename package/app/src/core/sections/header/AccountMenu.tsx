import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { logout } from "@/user/models/handler";
import { useUserProfileStore } from "@/user/states";
import { MiscMenuItems } from "../../components/header/MiscMenuItems";
import {
  LogOut as LogoutIcon,
  User as PersonIcon,
  Settings as SettingsIcon,
} from "lucide-react";

export type AccountMenuProps = {
  onLogout?: () => void;
};

export const AccountMenu: React.FC<AccountMenuProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const clearProfile = useUserProfileStore((state) => state.clearProfile);
  const user = useUserProfileStore((state) => state.user);

  const { t } = useTranslation();

  const handleLogout = () => {
    onLogout?.();
    clearProfile();
    navigate({ to: "/login" });
    void logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="account menu"
            aria-haspopup="true"
            className="h-9 rounded-full bg-transparent"
            {...props}
          >
            <Avatar className="w-9 h-9 rounded-md">
              {user?.avatar && (
                <AvatarImage src={user.avatar} alt={user?.name ?? ""} />
              )}
              <AvatarFallback>
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        )}
      />
      <DropdownMenuContent align="end" id="menu-appbar">
        <DropdownMenuItem
          render={(props) => (
            <Link
              to={`/user/me`}
              className="flex items-center gap-2"
              {...props}
            >
              <PersonIcon className="w-4 h-4" />
              <span>{t("navigation.profile")}</span>
            </Link>
          )}
        />
        <DropdownMenuItem
          render={(props) => (
            <Link
              to={`/user/me/setting/profile`}
              className="flex items-center gap-2"
              {...props}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>{t("navigation.settings")}</span>
            </Link>
          )}
        />
        <MiscMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogoutIcon className="w-4 h-4" />
          <span>{t("auth.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
