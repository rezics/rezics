import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { logout } from "@/user/models/handler";

export function PendingVerificationSection() {
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        render={(props) => (
          <Link to="/complete-registration" {...props}>
            {t("auth.flow.complete_registration_action")}
          </Link>
        )}
      />
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        {t("auth.logout")}
      </Button>
    </div>
  );
}
