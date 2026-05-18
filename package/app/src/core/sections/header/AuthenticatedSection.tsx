import { useDmStream } from "@rezics/api/dm/dm";
import {
  useNotificationStream,
  useUnreadCount,
} from "@rezics/api/notification";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { Badge, Button } from "@rezics/ui/shadcn";
import { Bell as NotificationsIcon } from "lucide-react";
import { CreateMenu } from "../../components/create-menu/CreateMenu.tsx";
import { AccountMenu } from "./AccountMenu.tsx";

export function AuthenticatedSection() {
  // Live notification + DM streams — mounted once at the authenticated
  // shell level. The DM stream invalidates conversation/thread caches
  // on each incoming `dm.message` or `dm.read` event.
  useNotificationStream();
  useDmStream();
  const { data } = useUnreadCount();
  const unread = data?.count ?? 0;
  const badgeText = unread > 99 ? "99+" : String(unread);

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Link to="/inbox/notification">
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unread > 0 ? `notifications (${unread} unread)` : "notifications"
          }
          className="relative h-9 min-w-9 rounded-full bg-transparent md:h-10 md:min-w-10"
        >
          <NotificationsIcon className="w-5 h-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            >
              {badgeText}
            </Badge>
          )}
        </Button>
      </Link>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log("Logout")} />
    </div>
  );
}
