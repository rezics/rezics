import SearchIcon from "@mui/icons-material/Search";
import { IconButton, TextField } from "@mui/material";
import type { SearchQuery } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import type { QueryMiddleware } from "../../hooks/useSearchQuery";

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
  size = "small",
  fullWidth = true,
}) => {
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
      <TextField
        fullWidth={fullWidth}
        size={size}
        label={label}
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <IconButton color="primary" onClick={commit} aria-label="search">
        <SearchIcon />
      </IconButton>
    </div>
  );
};
