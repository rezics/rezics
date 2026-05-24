import * as m from "@rezics/i18n/messages";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { LoginModal } from "@/user/pages/LoginPage";
import { RegisterModal } from "@/user/pages/RegisterPage";
import { MoreHorizMenu } from "../../components/header/MoreHorizMenu";

const LoginPrompt = () => {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Button
        variant="ghost"
        className="h-10 rounded-full border border-border-whisper bg-transparent px-4"
        render={(props) => (
          <Link to="/login" {...props}>
            {m.auth_login()}
          </Link>
        )}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        className="h-10 rounded-full border border-border-whisper bg-transparent px-4"
        onClick={() => setLoginModalOpen(true)}
      >
        {m.auth_login()}
      </Button>
      <Button
        variant="outline"
        className="h-10 rounded-full border-border-whisper bg-transparent px-4"
        onClick={() => setRegisterModalOpen(true)}
      >
        {m.auth_register()}
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
