import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { logout } from "@/user";

export function PendingVerificationSection() {
  const { t } = useTranslation(["auth"]);
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
            {t("auth:flow_complete_registration_action")}
          </Link>
        )}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-10 rounded-full border border-border-whisper bg-transparent px-4"
        onClick={handleLogout}
      >
        {t("auth:logout")}
      </Button>
    </div>
  );
}
