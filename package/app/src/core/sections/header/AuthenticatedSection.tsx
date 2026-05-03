import { IconButton } from "@mui/material";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { CreateMenu } from "../../components/create-menu/CreateMenu.tsx";
import { AccountMenu } from "./AccountMenu.tsx";
import { Bell as NotificationsIcon } from "lucide-react";

export function AuthenticatedSection() {
  return (
    <div className="flex items-center gap-2">
      <Link to="/inbox/notification">
        <IconButton>
          <NotificationsIcon />
        </IconButton>
      </Link>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log("Logout")} />
    </div>
  );
}
