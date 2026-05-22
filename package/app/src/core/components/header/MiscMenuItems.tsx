import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@rezics/ui/shadcn";
import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import { ThemeToggler } from "./ThemeToggler";
import { Languages as LanguageIcon } from "lucide-react";
import { setRezicsLocale } from "@/app/locale";
import * as m from "@rezics/i18n/messages";

const LANGUAGE_OPTIONS = Object.values(LANGUAGES);

export function MiscMenuItems() {
  const changeLang = (lang: Language) => setRezicsLocale(lang);

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <LanguageIcon className="w-4 h-4" />
          <span>{m.layout_header_toggle_language()}</span>
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
