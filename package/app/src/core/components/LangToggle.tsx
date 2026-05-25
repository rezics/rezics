import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { setLocale } from "@rezics/i18n/react";
import React from "react";

type LangToggleProps = {
  children: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
  }) => React.ReactNode;
};

const LANGUAGE_OPTIONS = Object.values(LANGUAGES);

export const LangToggle: React.FC<LangToggleProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);

  const handleChangeLang = (lang: Language) => {
    setOpen(false);
    setLocale(lang);
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
        {LANGUAGE_OPTIONS.map((language) => (
          <DropdownMenuItem
            key={language}
            onClick={() => handleChangeLang(language)}
          >
            {LANGUAGE_META[language].nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
