import { useNavigate } from "@tanstack/react-router";
import { type FC, useEffect } from "react";

/**
 * @deprecated Replaced by CompleteRegistrationPage.
 * This component redirects to /complete-registration.
 */
export const VerifyEmailPage: FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/complete-registration", replace: true });
  }, [navigate]);
  return null;
};
