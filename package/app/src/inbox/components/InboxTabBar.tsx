import { Link } from "@tanstack/react-router";
import type { FC } from "react";

interface InboxTabBarProps {
  active: "notifications" | "dm";
}

/**
 * Two-tab switcher between the Notifications view and the DM inbox.
 * Engagement-subscription introduces DM as a peer surface to the
 * existing notification stream; this bar lets users move between them
 * without losing their inbox context.
 */
export const InboxTabBar: FC<InboxTabBarProps> = ({ active }) => {
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
      {tab("notifications", "Notifications", "/inbox/notification")}
      {tab("dm", "Direct Messages", "/inbox/dm")}
    </nav>
  );
};

export default InboxTabBar;
