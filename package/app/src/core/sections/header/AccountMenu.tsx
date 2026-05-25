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
import { useNavigate } from "@tanstack/react-router";
import {
  LogOut as LogoutIcon,
  User as PersonIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import type React from "react";
import { Link, unitHref } from "@/shared/ui/link";
import { logout } from "@/user/models/handler";
import { useUserProfileStore } from "@/user/states";
import { MiscMenuItems } from "../../components/header/MiscMenuItems";
import { useMessage } from "@rezics/i18n/react";
import {
  app_account_menu_aria_label,
  auth_logout,
  navigation_profile,
  navigation_settings,
} from "@rezics/i18n/messages";
const m = {
  app_account_menu_aria_label,
  auth_logout,
  navigation_profile,
  navigation_settings,
};

const i18nMessages = {
  app_account_menu_aria_label,
  auth_logout,
  navigation_profile,
  navigation_settings,
};

export type AccountMenuProps = {
  onLogout?: () => void;
};

export const AccountMenu: React.FC<AccountMenuProps> = ({ onLogout }) => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const clearProfile = useUserProfileStore((state) => state.clearProfile);
  const user = useUserProfileStore((state) => state.user);
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
            aria-label={m.app_account_menu_aria_label()}
            aria-haspopup="true"
            className="h-10 min-w-10 rounded-md bg-transparent hover:bg-muted aria-expanded:bg-muted"
            {...props}
          >
            <Avatar className="w-8 h-8 rounded-md">
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
              to={
                user?.unitId
                  ? unitHref({
                      type: "USER",
                      unitId: user.unitId,
                      slug: user.slug ?? null,
                    })
                  : "/user/me"
              }
              className="flex items-center gap-2"
              {...props}
            >
              <PersonIcon className="w-4 h-4" />
              <span>{m.navigation_profile()}</span>
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
              <span>{m.navigation_settings()}</span>
            </Link>
          )}
        />
        <MiscMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogoutIcon className="w-4 h-4" />
          <span>{m.auth_logout()}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
