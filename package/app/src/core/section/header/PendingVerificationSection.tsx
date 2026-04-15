import { Button } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { logout } from "@/user/model/handler";

export function PendingVerificationSection() {
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outlined"
        size="small"
        component={Link}
        to="/verify-email"
      >
        {t("auth.flow.verify_banner_action")}
      </Button>
      <Button
        variant="text"
        size="small"
        color="inherit"
        onClick={handleLogout}
      >
        {t("auth.logout")}
      </Button>
    </div>
  );
}
