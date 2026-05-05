import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
import React from "react";
import { useTranslation } from "react-i18next";

type LangToggleProps = {
  children: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
  }) => React.ReactNode;
};

export const LangToggle: React.FC<LangToggleProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  const handleChangeLang = (lang: string) => {
    setOpen(false);
    changeLang(lang);
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
