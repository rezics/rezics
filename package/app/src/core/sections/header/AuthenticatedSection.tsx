import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { Button } from "@rezics/ui/shadcn";
import { Bell as NotificationsIcon } from "lucide-react";
import { CreateMenu } from "../../components/create-menu/CreateMenu.tsx";
import { AccountMenu } from "./AccountMenu.tsx";

export function AuthenticatedSection() {
  return (
    <div className="flex items-center gap-1 md:gap-2">
      <Link to="/inbox/notification">
        <Button
          variant="ghost"
          size="icon"
          aria-label="notifications"
          className="h-9 min-w-9 rounded-full bg-transparent md:h-10 md:min-w-10"
        >
          <NotificationsIcon className="w-5 h-5" />
        </Button>
      </Link>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log("Logout")} />
    </div>
  );
}
