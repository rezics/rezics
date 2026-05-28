import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  settings_nav_profile: () => getI18nRuntime().i18n.t("settings:nav_profile"),
  settings_nav_account: () => getI18nRuntime().i18n.t("settings:nav_account"),
  settings_nav_security: () => getI18nRuntime().i18n.t("settings:nav_security"),
  settings_nav_connections: () =>
    getI18nRuntime().i18n.t("settings:nav_connections"),
  settings_nav_tokens: () => getI18nRuntime().i18n.t("settings:nav_tokens"),
  settings_nav_preferences: () =>
    getI18nRuntime().i18n.t("settings:nav_preferences"),
  settings_nav_entities: () => getI18nRuntime().i18n.t("settings:nav_entities"),
} as const;
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CircleUser as AccountCircleIcon,
  Mail as EmailIcon,
  IdCard as IdentityIcon,
  Key as KeyIcon,
  Link as LinkIcon,
  ShieldCheck as SecurityIcon,
  SlidersHorizontal as TuneIcon,
} from "lucide-react";
import type { FC } from "react";

const SETTINGS_NAV = [
  {
    label: i18nMessages.settings_nav_profile,
    path: "profile",
    icon: AccountCircleIcon,
  },
  {
    label: i18nMessages.settings_nav_account,
    path: "account",
    icon: EmailIcon,
  },
  {
    label: i18nMessages.settings_nav_security,
    path: "security",
    icon: SecurityIcon,
  },
  {
    label: i18nMessages.settings_nav_connections,
    path: "connections",
    icon: LinkIcon,
  },
  { label: i18nMessages.settings_nav_tokens, path: "tokens", icon: KeyIcon },
  {
    label: i18nMessages.settings_nav_preferences,
    path: "preferences",
    icon: TuneIcon,
  },
] as const;

const EXTRA_NAV = [
  {
    label: i18nMessages.settings_nav_entities,
    to: "/user/me/entity",
    icon: IdentityIcon,
  },
] as const;

export const SettingsSidebar: FC = () => {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-1">
      {SETTINGS_NAV.map(({ label, path, icon: Icon }) => {
        const fullPath = `/user/me/setting/${path}`;
        const isActive = pathname.startsWith(fullPath);

        return (
          <li key={path}>
            <button
              type="button"
              onClick={() => void navigate({ to: fullPath })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                isActive
                  ? "bg-surface-elevated"
                  : "hover:bg-surface-elevated/60"
              }`}
            >
              <span className="min-w-[24px] flex items-center">
                <Icon className="w-4 h-4" />
              </span>
              <span>{label()}</span>
            </button>
          </li>
        );
      })}

      <li className="my-1 border-t border-border-whisper" aria-hidden="true" />

      {EXTRA_NAV.map(({ label, to, icon: Icon }) => {
        const isActive = pathname.startsWith(to);
        return (
          <li key={to}>
            <button
              type="button"
              onClick={() => void navigate({ to })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                isActive
                  ? "bg-surface-elevated"
                  : "hover:bg-surface-elevated/60"
              }`}
            >
              <span className="min-w-[24px] flex items-center">
                <Icon className="w-4 h-4" />
              </span>
              <span>{label()}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export { EXTRA_NAV, SETTINGS_NAV };
