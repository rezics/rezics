import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { useTranslation } from "react-i18next";
import { LangToggle } from "../LangToggle";
import { ThemeToggler } from "./ThemeToggler";
import { Languages as LanguageIcon } from "lucide-react";

export function MiscMenuItems() {
  const { t } = useTranslation();
  return (
    <>
      <LangToggle>
        {({ onClick }) => (
          <DropdownMenuItem onClick={onClick} onSelect={(e) => e.preventDefault()}>
            <LanguageIcon className="w-4 h-4" />
            <span>{t("layout.header.toggle_language")}</span>
          </DropdownMenuItem>
        )}
      </LangToggle>
      <ThemeToggler />
    </>
  );
}
