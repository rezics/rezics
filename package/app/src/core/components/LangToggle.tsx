import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import React from "react";
import { setRezicsLocale } from "@/app/locale";

type LangToggleProps = {
  children: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
  }) => React.ReactNode;
};

export const LangToggle: React.FC<LangToggleProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);

  const handleChangeLang = (lang: Language) => {
    setOpen(false);
    setRezicsLocale(lang);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={(props) => (
          <div {...props}>{children({ onClick: () => setOpen(true) })}</div>
        )}
      />
      <DropdownMenuContent
        align="center"
        side="bottom"
        className="min-w-[180px]"
      >
        <DropdownMenuItem onClick={() => handleChangeLang(LANGUAGES.ZH_HANT)}>
          {LANGUAGE_META["zh-hant"].nativeName}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeLang(LANGUAGES.EN)}>
          {LANGUAGE_META.en.nativeName}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeLang(LANGUAGES.JA)}>
          {LANGUAGE_META.ja.nativeName}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeLang(LANGUAGES.DE)}>
          {LANGUAGE_META.de.nativeName}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeLang(LANGUAGES.ZH_HANS)}>
          {LANGUAGE_META["zh-hans"].nativeName}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
