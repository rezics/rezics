import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import clsx from "clsx";
import type React from "react";
import { useEffect } from "react";
import { useAlertStore } from "../states/windowAlertStore";

export const WindowAlert: React.FC = () => {
  const { open, message } = useAlertStore();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      useAlertStore.getState().close();
    }, 2500);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={clsx(
        "fixed left-1/2 -translate-x-1/2 top-0 z-[9999] transition-transform duration-300",
        open ? "translate-y-3" : "-translate-y-full",
      )}
    >
      <Alert className="shadow-lg min-w-[280px]">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
};
