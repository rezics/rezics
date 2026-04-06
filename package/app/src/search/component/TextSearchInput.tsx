import type React from "react";
import { useRef, useState } from "react";
import { cn } from "@/shared/util/css-util";
import { SearchSuggestions } from "./SearchSuggestions";
import { TextSearchInputBase } from "./TextSearchInputBase";

export type TextSearchInputProps = {
  onSearch: (value: string) => void;
  defaultValue: { keyword: string };
  placeholder?: string;
  enableSuggestions?: boolean;
  className?: string;
  startAdornmentIcon?: React.ReactNode;
  size?: "small" | "medium";
  height?: number;
};

export const TextSearchInput = ({
  onSearch,
  defaultValue,
  placeholder,
  enableSuggestions = false,
  className,
  startAdornmentIcon,
  size = "small",
  height,
}: TextSearchInputProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [openSuggestion, setOpenSuggestion] = useState(false);

  const keyword = value.keyword ?? "";

  const handleValueChange = (keyword: string) => {
    setValue({ keyword });
    setOpenSuggestion(true);
  };

  const handleSubmit = (keyword: string) => {
    setOpenSuggestion(false);
    onSearch(keyword);
  };

  const handleSelectSuggestion = (keyword: string) => {
    setValue({ keyword });
    setOpenSuggestion(false);
    onSearch(keyword);
  };

  return (
    <div
      className={cn("relative", className)}
      ref={rootRef}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;

        // if focus moves to internal element, do not close
        if (rootRef.current?.contains(nextFocus)) {
          return;
        }

        setOpenSuggestion(false);
      }}
    >
      <TextSearchInputBase
        value={keyword}
        size={size}
        height={height}
        onValueChange={handleValueChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        className="w-full"
        startAdornmentIcon={startAdornmentIcon}
      />

      {enableSuggestions && openSuggestion && (
        <SearchSuggestions
          keyword={keyword}
          onSelect={handleSelectSuggestion}
        />
      )}
    </div>
  );
};
