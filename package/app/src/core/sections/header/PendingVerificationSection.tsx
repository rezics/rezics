import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { logout } from "@/user/models/handler";
import * as m from "@rezics/i18n/messages";

export function PendingVerificationSection() {
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
