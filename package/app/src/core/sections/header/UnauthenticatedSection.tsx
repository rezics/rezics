import { Button } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { LoginModal } from "@/user/pages/LoginPage";
import { RegisterModal } from "@/user/pages/RegisterPage";
import { MoreHorizMenu } from "../../components/header/MoreHorizMenu";

const LoginPrompt = () => {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const { t } = useTranslation();

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Button variant="text" component={Link} to="/login">
        {t("auth.login")}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="text" onClick={() => setLoginModalOpen(true)}>
        {t("auth.login")}
      </Button>
      <Button variant="outlined" onClick={() => setRegisterModalOpen(true)}>
        {t("auth.register")}
      </Button>

      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
      <RegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />
    </div>
  );
};

export function UnauthenticatedSection() {
  return (
    <>
      <LoginPrompt />
      <MoreHorizMenu />
    </>
  );
}
