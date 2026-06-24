"use client";

import { authDialogAtom } from "@/atoms/auth-dialog";
import { useAtomSet } from "@effect/atom-react";
import { useEffect } from "react";
import { AuthDialog } from "./AuthDialog";

function AuthDialogOpen({ mode }: { readonly mode: "login" | "register" }) {
  const set = useAtomSet(authDialogAtom);
  useEffect(() => {
    set({ open: true, mode });
  }, [set, mode]);
  return <AuthDialog />;
}

export default {
  Closed: <AuthDialog />,
  LoginMode: <AuthDialogOpen mode="login" />,
  RegisterMode: <AuthDialogOpen mode="register" />,
  LoginModeShortViewport: (
    <div className="h-[420px] overflow-hidden">
      <AuthDialogOpen mode="login" />
    </div>
  ),
  RegisterModeShortViewport: (
    <div className="h-[420px] overflow-hidden">
      <AuthDialogOpen mode="register" />
    </div>
  ),
};
