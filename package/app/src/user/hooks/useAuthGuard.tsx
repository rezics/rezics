import { useCallback } from "react";
import { useAuthModal } from "../components/useAuthModal";
import { useAuth } from "../pages/useAuth";

export function useAuthGuard() {
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  const requireAuth = useCallback(() => {
    if (isAuthenticated) return true;
    auth.openLogin();
    return false;
  }, [auth.openLogin, isAuthenticated]);

  const guard = useCallback(
    <Args extends unknown[]>(action: (...args: Args) => void) =>
      (...args: Args) => {
        if (!requireAuth()) return;
        action(...args);
      },
    [requireAuth],
  );

  return {
    isAuthenticated,
    requireAuth,
    guard,
    openLogin: auth.openLogin,
    AuthModal: auth.AuthModal,
  };
}
