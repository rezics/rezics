import { Button } from "@rezics/ui/shadcn";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { CreateMenu } from "../../components/create-menu/CreateMenu.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { Bell as NotificationsIcon } from "lucide-react";

export function AuthenticatedSection() {
  return (
    <div className="flex items-center gap-2">
      <Link to="/inbox/notification">
        <Button
          variant="ghost"
          size="icon"
          aria-label="notifications"
          className="h-10 min-w-10 rounded-full bg-transparent"
        >
          <NotificationsIcon className="w-5 h-5" />
        </Button>
      </Link>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log("Logout")} />
    </div>
  );
}
