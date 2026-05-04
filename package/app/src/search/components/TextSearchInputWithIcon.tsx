import { Button } from "@rezics/ui/shadcn";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextSearchInputBase } from "./TextSearchInputBase";

export const TextSearchInputWithIcon = ({
  onSearch,
  defaultValue,
  placeholder,
}: {
  onSearch: (value: string) => void;
  defaultValue: { keyword: string };
  placeholder?: string;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-2">
      <TextSearchInputBase
        value={value.keyword ?? ""}
        onValueChange={(keyword) => setValue({ keyword })}
        onSubmit={onSearch}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button
        size="icon"
        variant="ghost"
        className="text-text-brand"
        aria-label={t("accessibility.search")}
        onClick={() => onSearch(value.keyword ?? "")}
      >
        <SearchIcon />
      </Button>
    </div>
  );
};
