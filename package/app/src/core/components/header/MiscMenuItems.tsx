import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import { setLocale, useTranslation } from "@rezics/i18n/react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@rezics/ui/shadcn";
import { Languages as LanguageIcon } from "lucide-react";
import { ThemeToggler } from "./ThemeToggler";

const LANGUAGE_OPTIONS = Object.values(LANGUAGES);

export function MiscMenuItems() {
  const { t } = useTranslation(["shell"]);
const changeLang = (lang: Language) => setLocale(lang);

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <LanguageIcon className="w-4 h-4" />
          <span>{t("shell:layout_header_toggle_language")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {LANGUAGE_OPTIONS.map((language) => (
            <DropdownMenuItem
              key={language}
              onClick={() => changeLang(language)}
            >
              {LANGUAGE_META[language].nativeName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <ThemeToggler />
    </>
  );
}
