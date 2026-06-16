import { useTranslation } from "@rezics/i18n/react";
import { Link } from "@tanstack/react-router";
import type { FC } from "react";

interface InboxTabBarProps {
  active: "notifications" | "dm";
}

export const InboxTabBar: FC<InboxTabBarProps> = ({ active }) => {
  const { t } = useTranslation();
  const tab = (key: "notifications" | "dm", label: string, to: string) => {
    const isActive = key === active;
    return (
      <Link
        to={to}
        className={`px-3 py-2 text-sm transition-colors ${
          isActive
            ? "border-b-2 border-brand-fill text-text-primary"
            : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex items-center gap-2 border-b border-border-whisper">
      {tab("notifications", t("community:dm_notifications_tab"), "/inbox/notification")}
      {tab("dm", t("community:dm_dm_tab"), "/inbox/dm")}
    </nav>
  );
};
