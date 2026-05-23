import { Badge, Button, Input, Label } from "@rezics/ui/shadcn";
import type { TagRef } from "@rezics/contract";
import { X as CloseIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import * as m from "@rezics/i18n/messages";
import { useTagSuggest } from "../../hooks/useTagSuggest";

export type TagPickerProps = {
  value: TagRef[];
  onChange: (tags: TagRef[]) => void;
  label?: string;
  placeholder?: string;
  size?: "small" | "medium";
};

const tagIdentity = (t: TagRef): string => t.unitId ?? t.slug ?? "";

const tagLabel = (t: TagRef): string => t.name ?? t.slug ?? t.unitId ?? "";

export const TagPicker: React.FC<TagPickerProps> = ({
  value,
  onChange,
  label,
  placeholder,
}) => {
  const [inputValue, setInputValue] = useState("");
  const { suggestions } = useTagSuggest(inputValue);

  const commit = (raw: string) => {
    const tokens = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    const seen = new Set(value.map(tagIdentity));
    const added: TagRef[] = [];
    for (const slug of tokens) {
      if (!seen.has(slug)) {
        seen.add(slug);
        added.push({ slug });
      }
    }
    if (added.length > 0) {
      onChange([...value, ...added]);
    }
    setInputValue("");
  };

  const addSuggestion = (item: TagRef) => {
    const id = tagIdentity(item);
    if (!id) return;
    const seen = new Set(value.map(tagIdentity));
    if (seen.has(id)) return;
    onChange([
      ...value,
      {
        ...(item.unitId ? { unitId: item.unitId } : {}),
        ...(item.slug ? { slug: item.slug } : {}),
        ...(item.name ? { name: item.name } : {}),
      },
    ]);
    setInputValue("");
  };

  const removeTag = (id: string) => {
    onChange(value.filter((t) => tagIdentity(t) !== id));
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const v = e.target.value;
    if (v.includes(",")) {
      commit(v);
    } else {
      setInputValue(v);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      const last = value[value.length - 1];
      if (last) removeTag(tagIdentity(last));
    }
  };

  return (
    <div className="flex flex-col gap-1 relative">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input p-1">
        {value.map((tag, index) => {
          const id = tagIdentity(tag) || `idx-${index}`;
          return (
            <Badge
              key={id}
              variant="outline"
              className="flex items-center gap-1"
            >
              <span>{tagLabel(tag)}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 p-0"
                aria-label={m.tag_clear()}
                onClick={() => removeTag(tagIdentity(tag))}
              >
                <CloseIcon size={12} />
              </Button>
            </Badge>
          );
        })}
        <Input
          className="flex-1 min-w-[120px] border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 p-0 h-7"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) commit(inputValue);
          }}
        />
      </div>
      {inputValue.trim() && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface-elevated rounded-md shadow-lg border border-border-whisper max-h-60 overflow-auto">
          <ul>
            {suggestions.map((item) => {
              const id = tagIdentity(item);
              if (!id) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // prevent blur stealing focus
                      e.preventDefault();
                      addSuggestion(item);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-subtle"
                  >
                    {tagLabel(item)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
