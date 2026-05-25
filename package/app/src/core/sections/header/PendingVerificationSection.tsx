import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { logout } from "@/user/models/handler";
import { useMessage } from "@rezics/i18n/react";
import {
  auth_flow_complete_registration_action,
  auth_logout,
} from "@rezics/i18n/messages";
const m = {
  auth_flow_complete_registration_action,
  auth_logout,
};

const i18nMessages = {
  auth_flow_complete_registration_action,
  auth_logout,
};

export function PendingVerificationSection() {
  const m = useMessage(i18nMessages);
  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-10 rounded-full border-border-whisper bg-transparent px-4"
        render={(props) => (
          <Link to="/complete-registration" {...props}>
            {m.auth_flow_complete_registration_action()}
          </Link>
        )}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-10 rounded-full border border-border-whisper bg-transparent px-4"
        onClick={handleLogout}
      >
        {m.auth_logout()}
      </Button>
    </div>
  );
}
