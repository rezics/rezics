import type { SearchQuery } from "@rezics/contract";
import { accessibility_search } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { Search as SearchIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { QueryMiddleware } from "../../hooks/useSearchQuery";

const i18nMessages = {
  accessibility_search,
};

export type KeywordInputProps = {
  value: string;
  onChange: (keyword: string) => void;
  onSubmit?: () => void;
  onPatch?: (p: Partial<SearchQuery>) => void;
  middleware?: QueryMiddleware;
  placeholder?: string;
  label?: string;
  size?: "small" | "medium";
  fullWidth?: boolean;
};

export const KeywordInput: React.FC<KeywordInputProps> = ({
  value,
  onChange,
  onSubmit,
  onPatch,
  middleware,
  placeholder,
  label,
}) => {
  const m = useMessage(i18nMessages);
  const [local, setLocal] = useState(value);

  const commit = () => {
    const trimmed = local.trim();
    if (middleware && onPatch) {
      const patch = middleware(trimmed);
      onPatch(patch);
      const nextKeyword = patch.keyword ?? trimmed;
      onChange(nextKeyword);
      setLocal(nextKeyword);
    } else {
      onChange(trimmed);
      setLocal(trimmed);
    }
    onSubmit?.();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {label && <Label className="mb-1 block">{label}</Label>}
        <Input
          placeholder={placeholder}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="text-text-brand"
        onClick={commit}
        aria-label={m.accessibility_search()}
      >
        <SearchIcon />
      </Button>
    </div>
  );
};
