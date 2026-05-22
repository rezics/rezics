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
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.ZH_HANT)}>
            {LANGUAGE_META["zh-hant"].nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.EN)}>
            {LANGUAGE_META.en.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.JA)}>
            {LANGUAGE_META.ja.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.DE)}>
            {LANGUAGE_META.de.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.ZH_HANS)}>
            {LANGUAGE_META["zh-hans"].nativeName}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <ThemeToggler />
    </>
  );
}
